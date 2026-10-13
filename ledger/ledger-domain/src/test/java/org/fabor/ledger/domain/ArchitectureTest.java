package org.fabor.ledger.domain;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "org.fabor.ledger", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule pureDomain = noClasses().should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "org.apache.ibatis..", "java.sql..", "org.apache.kafka..")
            .because("ledger-domain is plain Java (rule 1)");

    @ArchTest
    static final ArchRule ledgerKnowsNoProducts = noClasses().should().dependOnClassesThat()
            .resideInAnyPackage("org.fabor.engine..", "org.fabor.lending..", "org.fabor.leasing..", "org.fabor.deposit..")
            .because("ledger depends on nothing product-specific (rule 5)");
}
