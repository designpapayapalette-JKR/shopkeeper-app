import {
  MODULE_CATEGORIES,
  ROLE_MODULES,
  ALL_MODULES,
  CATEGORY_COLORS,
  ModuleItem,
  ModuleCategory,
  UserRole,
} from "./moduleCategories";

export interface ModuleRegistration {
  key: string;
  label: string;
  icon: string;
  desc: string;
  route: string;
  gateKey?: string;
  categoryId: string;
}

export interface CategoryRegistration {
  id: string;
  label: string;
  icon: string;
  color: string;
  roles: UserRole[];
}

// Unified module registry — a flat, queryable view built from the
// category-based moduleCategories.ts definitions. Screens should use this
// instead of importing MODULE_CATEGORIES directly when they need to filter,
// search, or enumerate modules dynamically.
class ModuleRegistry {
  private modules: Map<string, ModuleRegistration> = new Map();
  private categories: Map<string, CategoryRegistration> = new Map();
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    for (const cat of MODULE_CATEGORIES) {
      this.categories.set(cat.id, {
        id: cat.id,
        label: cat.label,
        icon: cat.icon,
        color: CATEGORY_COLORS[cat.id] || "#6B7280",
        roles: cat.roles,
      });

      for (const child of cat.children) {
        this.modules.set(child.key, {
          ...child,
          categoryId: cat.id,
        });
      }
    }

    this.initialized = true;
  }

  getModule(key: string): ModuleRegistration | undefined {
    this.init();
    return this.modules.get(key);
  }

  getCategory(id: string): CategoryRegistration | undefined {
    this.init();
    return this.categories.get(id);
  }

  getAllModules(): ModuleRegistration[] {
    this.init();
    return Array.from(this.modules.values());
  }

  getAllCategories(): CategoryRegistration[] {
    this.init();
    return Array.from(this.categories.values());
  }

  getModulesForRole(role: UserRole | null | undefined): ModuleRegistration[] {
    this.init();
    if (!role) return [];
    const allowedKeys = new Set(ROLE_MODULES[role] || []);
    return this.getAllModules().filter((m) => allowedKeys.has(m.key));
  }

  getCategoriesForRole(role: UserRole | null | undefined): CategoryRegistration[] {
    this.init();
    if (!role) return [];
    const allowedKeys = new Set(ROLE_MODULES[role] || []);
    const categoryIds = new Set(
      this.getAllModules()
        .filter((m) => allowedKeys.has(m.key))
        .map((m) => m.categoryId)
    );
    return this.getAllCategories().filter((c) => categoryIds.has(c.id));
  }

  searchModules(query: string): ModuleRegistration[] {
    this.init();
    const q = query.toLowerCase();
    return this.getAllModules().filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q)
    );
  }
}

export const moduleRegistry = new ModuleRegistry();
