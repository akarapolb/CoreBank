package org.fabor.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
@EnableConfigurationProperties({FaborProperties.class, ConsoleProperties.class, EclProperties.class})
public class FaborApplication {
    public static void main(String[] args) {
        SpringApplication.run(FaborApplication.class, args);
    }
}
