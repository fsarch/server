export class Permission {
  private constructor(
    private readonly name: string,
    private readonly granted: boolean,
    private readonly resources: Array<string> | null,
  ) {}

  static granted(name: string, resources: Array<string> | null): Permission {
    return new Permission(name, true, resources);
  }

  static notGranted(name: string): Permission {
    return new Permission(name, false, []);
  }

  getName(): string {
    return this.name;
  }

  isGranted(): boolean {
    return this.granted;
  }

  /**
   * The resource ids this permission is scoped to, or `null` when it is
   * granted without any resource restriction (i.e. for all resources).
   */
  getResources(): Array<string> | null {
    return this.resources;
  }

  hasResource(resource: string): boolean {
    if (!this.granted) {
      return false;
    }

    if (this.resources === null) {
      return true;
    }

    return this.resources.includes(resource);
  }
}
