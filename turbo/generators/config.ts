// turbo/generators/config.ts
import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("package", {
    description: "Generate a new package",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "What is the name of the package?",
        validate: (input: string) => {
          if (input.length === 0) {
            return "Package name is required";
          }
          return true;
        },
      },
    ],
    actions: () => {      
      const actions: PlopTypes.ActionType[] = [
        // package.json
        {
          type: "add",
          path: "packages/{{name}}/package.json",
          templateFile: "templates/package.json.hbs",
        },
        // tsconfig.json
        {
          type: "add",
          path: "packages/{{name}}/tsconfig.json",
          templateFile: "templates/tsconfig.json.hbs",
        },
        // Main index.ts
        {
          type: "add",
          path: "packages/{{name}}/src/index.ts",
          templateFile: "templates/index.ts.hbs",
        },
      ];

      return actions;
    },
  });
}