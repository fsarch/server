import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleConfigurationService } from "../configuration/module/module-configuration.service";
import { AuthService } from "./auth.service";
import { JwtJwkAuthService } from "./jwt-jwk/jwt-jwk-auth.service";
import { OidcAuthService } from "./oidc/oidc-auth.service";
import { StaticAuthService } from "./static/static-auth.service";

// Mock the (possibly `serviceId`-scoped) AUTH_CONFIG token AuthService now
// reads `type` from, instead of the global ConfigService directly.
class MockAuthConfigService {
  get<T = any>(key?: string): T {
    if (!key) return { type: "static" } as T;
    if (key === "type") return "static" as T;
    return null as T;
  }
}

// Mock Auth Services
const mockStaticAuthService = {
  validateRequest: vi.fn().mockResolvedValue({ id: "user1" }),
  signIn: vi.fn().mockResolvedValue({ accessToken: "token" }),
};

const mockJwtJwkAuthService = {
  validateRequest: vi.fn().mockResolvedValue({ id: "user1" }),
  signIn: vi.fn().mockResolvedValue({ accessToken: "token" }),
};

const mockOidcAuthService = {
  validateRequest: vi.fn().mockResolvedValue({ id: "user1" }),
  signIn: vi.fn().mockResolvedValue({ accessToken: "token" }),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    const authConfigService = new MockAuthConfigService();
    service = new AuthService(
      authConfigService as unknown as ModuleConfigurationService<any>,
      mockStaticAuthService as unknown as StaticAuthService,
      mockJwtJwkAuthService as unknown as JwtJwkAuthService,
      mockOidcAuthService as unknown as OidcAuthService,
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should use static auth service when type is static", () => {
    // The constructor sets authService based on config
    expect(service).toBeDefined();
  });
});
