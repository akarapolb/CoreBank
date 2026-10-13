package org.fabor.platform.money;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "org.fabor.platform.money", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule noFloatingPointFields = noFields().should().haveRawType(double.class)
            .orShould().haveRawType(float.class).orShould().haveRawType(Double.class).orShould().haveRawType(Float.class)
            .because("money must never use floating point (rule 6)");

    @ArchTest
    static final ArchRule noFrameworks = noClasses().should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "org.apache.ibatis..", "java.sql..", "org.apache.kafka..")
            .because("platform kernel is plain Java (rules 1 and 4)");
}
