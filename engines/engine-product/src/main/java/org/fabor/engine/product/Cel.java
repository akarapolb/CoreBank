package org.fabor.engine.product;

import dev.cel.common.CelAbstractSyntaxTree;
import dev.cel.common.CelValidationException;
import dev.cel.common.types.SimpleType;
import dev.cel.compiler.CelCompiler;
import dev.cel.compiler.CelCompilerFactory;
import dev.cel.common.CelFunctionDecl;
import dev.cel.common.CelOverloadDecl;
import dev.cel.runtime.CelEvaluationException;
import dev.cel.runtime.CelFunctionBinding;
import dev.cel.runtime.CelRuntime;
import dev.cel.runtime.CelRuntimeFactory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * Bounded expression language for product rules. CEL guarantees termination and has no side effects.
 * Money is always an {@code int} in minor units; rates are {@code double} literals only ever fed to
 * {@code rate(amount, r)}, which rounds half-up in BigDecimal, so no floating point reaches an amount.
 * Library: {@code min(a,b)}, {@code max(a,b)}, {@code rate(amount, r)}.
 */
public final class Cel {
    private static final CelRuntime RUNTIME = CelRuntimeFactory.standardCelRuntimeBuilder()
            .addFunctionBindings(
                    CelFunctionBinding.from("min_int_int", Long.class, Long.class, Math::min),
                    CelFunctionBinding.from("max_int_int", Long.class, Long.class, Math::max),
                    CelFunctionBinding.from("rate_int_double", Long.class, Double.class,
                            (amount, r) -> BigDecimal.valueOf(amount).multiply(BigDecimal.valueOf(r))
                                    .setScale(0, RoundingMode.HALF_UP).longValueExact()))
            .build();

    private Cel() { }

    /** A compiled expression that yields minor units. */
    public record Expression(String source, CelAbstractSyntaxTree ast) {
        public long evaluate(Map<String, Long> variables) {
            try {
                Object r = RUNTIME.createProgram(ast).eval(Map.copyOf(variables));
                if (!(r instanceof Long l)) {
                    throw new IllegalStateException("Expression did not produce an integer: " + source);
                }
                return l;
            } catch (CelEvaluationException e) {
                throw new IllegalArgumentException("Cannot evaluate '" + source + "': " + e.getMessage(), e);
            }
        }
    }

    /** Compiles and type-checks against the declared variables (all {@code int}); the result must be {@code int}. */
    public static Expression compile(String source, List<String> intVariables) {
        var builder = CelCompilerFactory.standardCelCompilerBuilder()
                .addFunctionDeclarations(
                        fn("min", "min_int_int", SimpleType.INT, SimpleType.INT, SimpleType.INT),
                        fn("max", "max_int_int", SimpleType.INT, SimpleType.INT, SimpleType.INT),
                        fn("rate", "rate_int_double", SimpleType.INT, SimpleType.INT, SimpleType.DOUBLE))
                .setResultType(SimpleType.INT);
        for (String v : intVariables) {
            builder.addVar(v, SimpleType.INT);
        }
        try {
            return new Expression(source, builder.build().compile(source).getAst());
        } catch (CelValidationException e) {
            throw new IllegalArgumentException("Invalid expression '" + source + "': " + e.getMessage(), e);
        }
    }

    private static CelFunctionDecl fn(String name, String overload, dev.cel.common.types.CelType result, dev.cel.common.types.CelType... args) {
        return CelFunctionDecl.newFunctionDeclaration(name,
                CelOverloadDecl.newGlobalOverload(overload, result, args));
    }
}
