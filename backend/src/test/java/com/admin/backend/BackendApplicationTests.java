package com.admin.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Boots the full app against a throwaway in-memory database: Liquibase runs every changeset and
 * Hibernate's {@code ddl-auto: validate} fails the test if an entity doesn't match the schema.
 */
@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
		"app.jwt.secret=test-secret-that-is-at-least-32-characters-long",
		"app.admin.email=",
		"app.admin.password=",
})
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
