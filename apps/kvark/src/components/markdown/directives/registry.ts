import type {
    DirectiveDefinition,
    DirectiveRegistry,
} from "@tihlde/ui/complex/markdown";

export function createRegistry(
    directives: ReadonlyArray<DirectiveDefinition>,
): DirectiveRegistry {
    const map = new Map<string, DirectiveDefinition>();
    for (const directive of directives) {
        if (map.has(directive.name)) {
            throw new Error(
                `Duplicate directive in registry: ${directive.name}`,
            );
        }
        map.set(directive.name, directive);
    }
    return {
        directives,
        get: (name) => map.get(name),
        has: (name) => map.has(name),
    };
}

/** Compose registries (later wins on conflict). */
export function composeRegistries(
    ...registries: ReadonlyArray<DirectiveRegistry>
): DirectiveRegistry {
    const merged = new Map<string, DirectiveDefinition>();
    for (const registry of registries) {
        for (const directive of registry.directives) {
            merged.set(directive.name, directive);
        }
    }
    return createRegistry([...merged.values()]);
}

export const emptyRegistry: DirectiveRegistry = createRegistry([]);
