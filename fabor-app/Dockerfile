# Build:  mvn -pl fabor-app -am package -DskipTests && docker build -f fabor-app/Dockerfile -t fabor-app .
# Run as a non-root user on a slim Temurin 21 JRE.
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 --no-create-home fabor
WORKDIR /app
COPY fabor-app/target/fabor-app-*.jar /app/fabor-app.jar
USER 10001
EXPOSE 8080 8081 9090
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/fabor-app.jar"]
