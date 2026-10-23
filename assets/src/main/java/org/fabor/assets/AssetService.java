package org.fabor.assets;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.fabor.platform.money.Money;

/**
 * The asset register: what is financed, where it is, who holds the title and whether it is insured.
 *
 * <p>Lifecycle: ORDERED from a dealer, DELIVERED (a vehicle must then have a registration number), ACTIVE once it
 * secures a loan or lease (and, if the product requires it, is insured), then either RETURNED to the lessor at the end
 * of a lease or DISPOSED of when the title passes to the customer after the contract is settled. Title stays with the
 * lessor until then, and every change is kept as a title event.
 */
public final class AssetService {
    /** A loan or lease as seen from the register: does it exist, and has it been paid off. */
    public record ContractState(String id, boolean settled) { }

    /** Looks contracts up by id; the application implements it over the loan and lease repositories. */
    @FunctionalInterface
    public interface ContractLookup {
        Optional<ContractState> find(String contractId);
    }

    private final AssetRepo repo;
    private final ContractLookup contracts;

    public AssetService(AssetRepo repo, ContractLookup contracts) {
        this.repo = repo;
        this.contracts = contracts;
    }

    /** Registers an asset ordered from a dealer. Serial numbers (VIN, chassis) are unique. */
    public Asset order(String id, Asset.Kind kind, String make, String model, String serialNo, String dealerId, Money cost,
                       String location) {
        if (id == null || id.isBlank() || make == null || make.isBlank() || model == null || model.isBlank()) {
            throw new IllegalArgumentException("An asset needs an id, a make and a model");
        }
        String serial = normalise(serialNo);
        if (serial.isEmpty() || serial.length() > 40) {
            throw new IllegalArgumentException("Serial number must be 1 to 40 characters");
        }
        if (cost.minor() <= 0) {
            throw new IllegalArgumentException("Cost must be positive");
        }
        if (repo.find(id).isPresent()) {
            throw new IllegalStateException("Asset already exists: " + id);
        }
        if (repo.findBySerial(serial).isPresent()) {
            throw new IllegalStateException("An asset with serial number " + serial + " is already registered");
        }
        Asset a = new Asset(id, kind, make, model, serial, null, null, dealerId, cost.currency().code(), cost.minor(), null,
                Asset.Status.ORDERED, location, Asset.Condition.NEW, Asset.TitleHolder.LESSOR);
        repo.save(a);
        return a;
    }

    /** The asset has arrived. A vehicle needs its registration number; the title is registered in the lessor's name. */
    public Asset deliver(String id, String registrationNo, String engineNo, LocalDate date) {
        Asset a = load(id);
        if (a.status() != Asset.Status.ORDERED) {
            throw new IllegalStateException("Asset " + id + " is " + a.status() + ", not ORDERED");
        }
        if (a.kind() == Asset.Kind.VEHICLE && (registrationNo == null || registrationNo.isBlank())) {
            throw new IllegalArgumentException("A delivered vehicle needs a registration number");
        }
        Asset delivered = a.withDelivery(engineNo, registrationNo == null || registrationNo.isBlank() ? null : registrationNo.trim());
        repo.save(delivered);
        repo.addTitleEvent(new TitleEvent(id, date, null, Asset.TitleHolder.LESSOR, "delivery", "Title registered with the lessor"));
        return delivered;
    }

    /** Puts a delivered asset under a loan or lease. With {@code insuranceRequired} it must be covered on that day. */
    public Asset activate(String id, String contractId, LocalDate date, boolean insuranceRequired) {
        Asset a = load(id);
        if (a.status() != Asset.Status.DELIVERED) {
            throw new IllegalStateException("Asset " + id + " is " + a.status() + ", not DELIVERED");
        }
        if (contracts.find(contractId).isEmpty()) {
            throw new IllegalArgumentException("Unknown contract " + contractId);
        }
        if (insuranceRequired && coverage(id, date).isEmpty()) {
            throw new IllegalStateException("Asset " + id + " has no insurance cover on " + date);
        }
        Asset active = a.withContract(contractId);
        repo.save(active);
        return active;
    }

    public Asset relocate(String id, String location) {
        Asset a = requireLive(id);
        Asset moved = a.withLocation(location);
        repo.save(moved);
        return moved;
    }

    public Asset recondition(String id, Asset.Condition condition) {
        Asset a = requireLive(id);
        Asset updated = a.withCondition(condition);
        repo.save(updated);
        return updated;
    }

    /** Records an insurance policy. The same insurer and policy number cannot be recorded twice. */
    public Policy addPolicy(String assetId, String insurer, String policyNo, LocalDate from, LocalDate to, Money sumInsured,
                            Money premium, boolean financed) {
        requireLive(assetId);
        Policy p = new Policy(assetId, insurer, policyNo, from, to, sumInsured.minor(), premium.minor(), financed);
        boolean duplicate = repo.policies(assetId).stream()
                .anyMatch(existing -> existing.insurer().equals(insurer) && existing.policyNo().equals(policyNo));
        if (duplicate) {
            throw new IllegalStateException("Policy " + policyNo + " of " + insurer + " is already recorded");
        }
        repo.addPolicy(p);
        return p;
    }

    /** The policy covering the asset on {@code day}; the one that runs longest if several do. */
    public Optional<Policy> coverage(String assetId, LocalDate day) {
        return repo.policies(assetId).stream().filter(p -> p.covers(day)).max(java.util.Comparator.comparing(Policy::to));
    }

    /** Active assets with no insurance cover on {@code day}. */
    public List<Asset> uninsured(LocalDate day) {
        return repo.byStatus(Asset.Status.ACTIVE).stream().filter(a -> coverage(a.id(), day).isEmpty()).toList();
    }

    /** Active assets whose cover is in force on {@code day} but ends within {@code days} days and has not been renewed. */
    public List<Asset> expiringCover(LocalDate day, int days) {
        LocalDate limit = day.plusDays(days);
        return repo.byStatus(Asset.Status.ACTIVE).stream().filter(a -> {
            LocalDate latest = repo.policies(a.id()).stream().map(Policy::to).max(java.util.Comparator.naturalOrder())
                    .orElse(LocalDate.MIN);
            return coverage(a.id(), day).isPresent() && !latest.isAfter(limit);
        }).toList();
    }

    /**
     * Passes the title to the customer once the contract is settled; the asset is then DISPOSED. Idempotent per
     * reference: repeating the call that already did it returns the asset.
     */
    public Asset transferTitle(String id, LocalDate date, String reference) {
        Asset a = load(id);
        List<TitleEvent> events = repo.titleEvents(id);
        if (a.titleHolder() == Asset.TitleHolder.CUSTOMER) {
            if (events.get(events.size() - 1).reference().equals(reference)) {
                return a;
            }
            throw new IllegalStateException("Title of " + id + " has already passed to the customer");
        }
        if (a.status() != Asset.Status.ACTIVE) {
            throw new IllegalStateException("Asset " + id + " is " + a.status() + ", not ACTIVE");
        }
        if (!settled(a)) {
            throw new IllegalStateException("The title stays with the lessor until contract " + a.contractId() + " is paid off");
        }
        Asset moved = a.withTitleTransferred();
        repo.save(moved);
        repo.addTitleEvent(new TitleEvent(id, date, Asset.TitleHolder.LESSOR, Asset.TitleHolder.CUSTOMER, reference,
                "Contract " + a.contractId() + " paid off"));
        return moved;
    }

    /** End of a lease: the asset goes back to the lessor, which keeps the title. The contract must be settled. */
    public Asset returnToLessor(String id) {
        Asset a = load(id);
        if (a.status() != Asset.Status.ACTIVE) {
            throw new IllegalStateException("Asset " + id + " is " + a.status() + ", not ACTIVE");
        }
        if (!settled(a)) {
            throw new IllegalStateException("Contract " + a.contractId() + " is not settled");
        }
        Asset returned = a.withStatus(Asset.Status.RETURNED);
        repo.save(returned);
        return returned;
    }

    /**
     * The asset is taken back from a customer in default: it leaves ACTIVE for REPOSSESSED, keeps its contract (the debt
     * it secures) and the lessor's title, and is recorded at {@code location} in the condition found. Whether the
     * contract is in default is the caller's check.
     */
    public Asset repossess(String id, String location, Asset.Condition condition) {
        Asset a = load(id);
        if (a.status() != Asset.Status.ACTIVE) {
            throw new IllegalStateException("Asset " + id + " is " + a.status() + ", not ACTIVE");
        }
        Asset taken = a.withStatus(Asset.Status.REPOSSESSED).withLocation(location).withCondition(condition);
        repo.save(taken);
        return taken;
    }

    /** A repossessed asset has been sold to a third party. */
    public Asset sellRepossessed(String id) {
        Asset a = load(id);
        if (a.status() != Asset.Status.REPOSSESSED) {
            throw new IllegalStateException("Asset " + id + " is " + a.status() + ", not REPOSSESSED");
        }
        Asset sold = a.withStatus(Asset.Status.DISPOSED);
        repo.save(sold);
        return sold;
    }

    public Optional<Asset> find(String id) {
        return repo.find(id);
    }

    public List<TitleEvent> titleHistory(String id) {
        return repo.titleEvents(id);
    }

    public List<Asset> assetsOf(String contractId) {
        return repo.byContract(contractId);
    }

    private boolean settled(Asset a) {
        return contracts.find(a.contractId()).map(ContractState::settled).orElse(false);
    }

    private Asset requireLive(String id) {
        Asset a = load(id);
        if (a.status() == Asset.Status.DISPOSED) {
            throw new IllegalStateException("Asset " + id + " has been disposed of");
        }
        return a;
    }

    private Asset load(String id) {
        return repo.find(id).orElseThrow(() -> new IllegalArgumentException("Unknown asset " + id));
    }

    private static String normalise(String serial) {
        return serial == null ? "" : serial.trim().toUpperCase(java.util.Locale.ROOT);
    }
}
