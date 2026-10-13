package org.fabor.app;

import java.util.List;
import java.util.Map;
import org.fabor.catalog.CatalogStore;
import org.fabor.catalog.Draft;
import org.fabor.catalog.MasterBuilder;
import org.fabor.catalog.PublishedVersion;
import org.fabor.catalog.ReviewReport;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Master Builder over HTTP: draft, check, submit, approve, publish. The actor comes from X-Actor (see ApiTokenFilter). */
@RestController
@RequestMapping("/api/v1/products")
class ProductsController {
    private final MasterBuilder builder;
    private final CatalogStore store;

    ProductsController(MasterBuilder builder, CatalogStore store) {
        this.builder = builder;
        this.store = store;
    }

    record DraftView(String id, String product, int version, String status, Map<String, String> approvals) {
        static DraftView of(Draft d) {
            return new DraftView(d.id(), d.product(), d.version(), d.status().name(), d.approvals());
        }
    }

    record VersionView(String product, int version, String goldenHash, String publishedBy, boolean retired) {
        static VersionView of(PublishedVersion v) {
            return new VersionView(v.product(), v.version(), v.goldenHash(), v.publishedBy(), v.retired());
        }
    }

    record ApproveRequest(String role) { }

    @PostMapping(value = "/drafts", consumes = {"application/yaml", MediaType.TEXT_PLAIN_VALUE})
    DraftView create(@RequestHeader("X-Actor") String actor, @RequestBody String yaml) {
        return DraftView.of(builder.createDraft(actor, yaml));
    }

    @PostMapping(value = "/drafts/{id}/yaml", consumes = {"application/yaml", MediaType.TEXT_PLAIN_VALUE})
    DraftView update(@RequestHeader("X-Actor") String actor, @PathVariable String id, @RequestBody String yaml) {
        return DraftView.of(builder.updateDraft(id, actor, yaml));
    }

    @GetMapping("/drafts/{id}/check")
    ReviewReport check(@PathVariable String id) {
        return builder.check(id);
    }

    @PostMapping("/drafts/{id}/submit")
    DraftView submit(@RequestHeader("X-Actor") String actor, @PathVariable String id) {
        return DraftView.of(builder.submit(id, actor));
    }

    @PostMapping("/drafts/{id}/approve")
    DraftView approve(@RequestHeader("X-Actor") String actor, @PathVariable String id, @RequestBody ApproveRequest r) {
        return DraftView.of(builder.approve(id, actor, r.role()));
    }

    @PostMapping("/drafts/{id}/publish")
    VersionView publish(@RequestHeader("X-Actor") String actor, @PathVariable String id) {
        return VersionView.of(builder.publish(id, actor));
    }

    @GetMapping("/{product}/versions")
    List<VersionView> versions(@PathVariable String product) {
        return store.versions(product).stream().map(VersionView::of).toList();
    }

    @PostMapping("/{product}/versions/{version}/retire")
    Map<String, Object> retire(@PathVariable String product, @PathVariable int version) {
        builder.retire(product, version);
        return Map.of("product", product, "version", version, "retired", true);
    }
}
