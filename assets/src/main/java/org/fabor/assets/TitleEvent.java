package org.fabor.assets;

import java.time.LocalDate;

/** One change of who holds the title to an asset. {@code from} is null for the first registration. */
public record TitleEvent(String assetId, LocalDate on, Asset.TitleHolder from, Asset.TitleHolder to, String reference,
                         String note) { }
