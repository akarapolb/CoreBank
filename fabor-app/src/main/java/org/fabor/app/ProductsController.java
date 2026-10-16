package org.fabor.app;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import org.fabor.catalog.CatalogStore;
import org.fabor.catalog.Draft;
import org.fabor.catalog.MasterBuilder;
import org.fabor.catalog.PublishedVersion;
import org.fabor.catalog.ReviewReport;
import org.fabor.engine.product.Disclosure;
import org.fabor.engine.product.ProductDefinition;
import org.fabor.engine.product.ProductQuote;
import org.fabor.platform.money.Currency;
import org.fabor.platform.money.Money;
import org.fabor.platform.time.BusinessCalendar;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Master Builder over HTTP: draft, check, submit, approve, publish. The actor and roles come from the verified token (see SecurityConfig). */
@RestController
@RequestMapping("/api/v1/products")
class ProductsController {
    private final MasterBuilder builder;
    private final CatalogStore store;
    private final BiFunction<String, Integer, ProductDefinition> products;
    private final BusinessCalendar calendar;

    ProductsController(MasterBuilder builder, CatalogStore store, BiFunction<String, Integer, ProductDefinition> products,
                       BusinessCalendar calendar) {
        this.builder = builder;
        this.store = store;
        this.products = products;
        this.calendar = calendar;
    }

    record DraftView(String id, String product, int version, String status, Map<String, String> approvals, String author) {
        static DraftView of(Draft d) {
            return new DraftView(d.id(), d.product(), d.version(), d.status().name(), d.approvals(), d.author());
        }
    }

    record VersionView(String product, int version, String goldenHash, String publishedBy, boolean retired) {
        static VersionView of(PublishedVersion v) {
            return new VersionView(v.product(), v.version(), v.goldenHash(), v.publishedBy(), v.retired());
        }
    }

    record ApproveRequest(String role) { }

    @GetMapping("/drafts")
    List<DraftView> drafts() {
        return store.openDrafts().stream().map(DraftView::of).toList();
    }

    @PostMapping(value = "/drafts", consumes = {"application/yaml", MediaType.TEXT_PLAIN_VALUE})
    DraftView create(Actor actor, @RequestBody String yaml) {
        return DraftView.of(builder.createDraft(actor.require("product-maker").name(), yaml));
    }

    @PostMapping(value = "/drafts/{id}/yaml", consumes = {"application/yaml", MediaType.TEXT_PLAIN_VALUE})
    DraftView update(Actor actor, @PathVariable String id, @RequestBody String yaml) {
        return DraftView.of(builder.updateDraft(id, actor.require("product-maker").name(), yaml));
    }

    @GetMapping("/drafts/{id}/check")
    ReviewReport check(@PathVariable String id) {
        return builder.check(id);
    }

    @PostMapping("/drafts/{id}/submit")
    DraftView submit(Actor actor, @PathVariable String id) {
        return DraftView.of(builder.submit(id, actor.require("product-maker").name()));
    }

    @PostMapping("/drafts/{id}/approve")
    DraftView approve(Actor actor, @PathVariable String id, @RequestBody ApproveRequest r) {
        return DraftView.of(builder.approve(id, actor.require("approver-" + String.valueOf(r.role()).toLowerCase()).name(), r.role()));
    }

    @PostMapping("/drafts/{id}/publish")
    VersionView publish(Actor actor, @PathVariable String id) {
        return VersionView.of(builder.publish(id, actor.require("product-publisher").name()));
    }

    @GetMapping("/{product}/versions")
    List<VersionView> versions(@PathVariable String product) {
        return store.versions(product).stream().map(VersionView::of).toList();
    }

    @PostMapping("/{product}/versions/{version}/retire")
    Map<String, Object> retire(Actor actor, @PathVariable String product, @PathVariable int version) {
        actor.require("product-publisher");
        builder.retire(product, version);
        return Map.of("product", product, "version", version, "retired", true);
    }

    /** The cost-of-credit disclosure for a published version: quoted and effective rates, fees, totals. */
    @GetMapping("/{product}/versions/{version}/disclosure")
    Map<String, Object> disclosure(@PathVariable String product, @PathVariable int version,
                                   @RequestParam BigDecimal principal, @RequestParam int term,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        ProductDefinition d = products.apply(product, version);
        if (d == null) {
            throw new IllegalArgumentException("No published version " + product + " v" + version);
        }
        Money amount = Money.of(principal, Currency.of(d.currency()));
        Disclosure x = Disclosure.of(d, amount, ProductQuote.quote(d, amount, term, date == null ? LocalDate.now() : date, calendar));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("product", x.product());
        out.put("version", x.version());
        out.put("flat", x.flat());
        out.put("quotedRate", x.quotedRate().toPlainString());
        out.put("effectiveRate", x.effectiveRate().toPlainString());
        out.put("allInEffectiveRate", x.allInEffectiveRate().toPlainString());
        out.put("lines", x.lines());
        out.put("text", x.text());
        return out;
    }
}
