package org.fabor.engine.product;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.core.JsonProcessingException;

public final class ProductLoader {
    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory())
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY);

    private ProductLoader() { }

    /** Parses YAML; throws {@link IllegalArgumentException} with a readable message on syntax or unknown keys. */
    public static ProductDefinition parse(String yaml) {
        try {
            return YAML.readValue(yaml, ProductDefinition.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid product definition: " + e.getOriginalMessage(), e);
        }
    }

}
