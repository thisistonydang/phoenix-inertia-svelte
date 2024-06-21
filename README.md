# Phoenix with Inertia.js and Svelte ❤️

This repo contains an example project and guide for setting up [Phoenix](https://www.phoenixframework.org/) with [Inertia.js](https://inertiajs.com/) and [Svelte](https://svelte.dev/), including server-side rendering (SSR).

In addition to setting up Inertia and Svelte, there is an [optional section](#extra-setup-optional) that covers setup for:

- [Switching from CommonJS to ESM](#switching-from-commonjs-to-esm)
- [TypeScript](#typescript)
- [Path Aliases](#path-aliases)
- [Prettier](#prettier)
- [ESLint](#eslint)
- [daisyUI](#daisyui)
- [Font Awesome Icons](#font-awesome-icons)
- [Environment Variables](#environment-variables)
- [Local network development](#local-network-development)
- [Credo](#credo)
- [Sobelow](#sobelow)

There is also a section at the very end that covers [deployment](#deployment) to Fly.io.

If there's a mistake or you have any suggestions for improvement, please feel free to open an issue or PR! 🙏

## Live Demo

A live demo of the project in this repo can be found [here](https://phoenix-inertia-svelte.fly.dev/).

## Inertia and Svelte Setup Guide

### Create a new Phoenix project

```bash
mix phx.new app --database sqlite3
mix ecto.create
git init && git add -A && git commit -m "Initial commit"
```

We're using `sqlite3` for this example, but you can use any database you prefer.

### Follow the `inertia-phoenix` installation guide

After creating a new Phoenix project, follow the installation instructions for adding the `inertia-phoenix` package [here](https://github.com/inertiajs/inertia-phoenix?tab=readme-ov-file#installation).

Continue with the following steps AFTER you have completed the installation instructions in the `inertia-phoenix` README.

### Install dependencies

Install the `inertia-phoenix` dependencies if you haven't already.

```sh
mix deps.get
```

Install the required `npm` dependencies in the `assets` directory.

```sh
npm --prefix assets install -D esbuild esbuild-svelte
npm --prefix assets install \
    @inertiajs/svelte \
    ./deps/phoenix \
    ./deps/phoenix_html \
    ./deps/phoenix_live_view
```

**Note:** The `--prefix assets` option allows us to install the dependencies in the `assets` directory while being in the root directory of the project.

### Update your main `app.js` entry file

Add the following code to your `app.js` file. This script will be responsible for creating and hydrating the Svelte app on the client-side.

```diff
// assets/js/app.js
+ import { createInertiaApp } from "@inertiajs/svelte";
+ import axios from "axios";

+ axios.defaults.xsrfHeaderName = "x-csrf-token";
+
+ createInertiaApp({
+   page: undefined, // This undefined prop is to avoid TS errors
+   resolve: async (name) => await import(`./pages/${name}.svelte`),
+   setup({ el, App }) {
+     new App({ target: el, hydrate: true });
+   },
+ });
```

### Add a `ssr.js` file

The `ssr.js` module is required for rendering the Svelte app on the server-side when SSR is enabled.

```js
// assets/js/ssr.js
import { createInertiaApp } from "@inertiajs/svelte";

export function render(page) {
  return createInertiaApp({
    page,
    resolve: async (name) => await import(`./pages/${name}.svelte`),
    setup({ el, App }) {
      new App({ target: el, hydrate: true });
    },
  });
}
```

### Add a custom `esbuild` build script

When using Svelte with `esbuild`, the `esbuild-svelte` plugin is required to compile Svelte components. However, Phoenix's default configuration of `esbuild` (via the Elixir wrapper) does not allow you to use `esbuild` plugins so we need to create a custom build script that will handle both the client-side and server-side builds.

More information about creating custom `esbuild` scripts can be found in the official Phoenix [documentation](https://hexdocs.pm/phoenix/asset_management.html#esbuild-plugins).

```js
// assets/build.js
const esbuild = require("esbuild");
const sveltePlugin = require("esbuild-svelte");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const deploy = args.includes("--deploy");
const ssr = args.includes("--ssr");

const clientOpts = {
  entryPoints: ["js/app.js"],
  bundle: true,
  minify: deploy,
  sourcemap: watch && "inline",
  logLevel: "info",
  target: "es2017",
  outdir: "../priv/static/assets",
  external: ["*.css", "fonts/*", "images/*"],
  nodePaths: ["../deps"],
  plugins: [
    sveltePlugin({
      compilerOptions: {
        dev: watch,
        hydratable: true,
        generate: "dom",
        css: "external",
      },
    }),
  ],
};

const serverOpts = {
  entryPoints: ["js/ssr.js"],
  bundle: true,
  minify: false,
  sourcemap: watch && "inline",
  logLevel: "info",
  platform: "node",
  format: "cjs",
  outdir: "../priv",
  external: ["*.css", "fonts/*", "images/*"],
  nodePaths: ["../deps"],
  plugins: [
    sveltePlugin({
      compilerOptions: {
        dev: watch,
        hydratable: true,
        generate: "ssr",
        css: "none",
      },
    }),
  ],
};

const opts = ssr ? serverOpts : clientOpts;

if (watch) {
  esbuild
    .context(opts)
    .then((ctx) => {
      ctx.watch();
    })
    .catch((_error) => {
      process.exit(1);
    });
} else {
  esbuild.build(opts);
}
```

### Update Tailwind configuration

When generating the client-side bundle, the above `build.js` script may generate an `app.css` file, in addition to the `app.js` file, and place it into the `priv/static/assets` directory. The reason for this is because Svelte will generate hashed class names in order to [scope styles](https://svelte.dev/docs/svelte-components#style) to the component.

Since the standard Phoenix Tailwind configuration already generates an `app.css` into the same directory, we need to update the Tailwind configuration to specify a different output name to avoid conflict.

```diff
# config/config.exs
config :tailwind,
  version: "3.4.0",
  app: [
    args: ~w(
      --config=tailwind.config.js
      --input=css/app.css
-     --output=../priv/static/assets/app.css
+     --output=../priv/static/assets/tailwind.css
    ),
    cd: Path.expand("../assets", __DIR__)
  ]
```

Please note that an `app.css` file will not be generated if you are not using CSS styles within a `<style>` block in your Svelte components. However, it is still recommended to update the Tailwind configuration because it is possible that an `app.css` file may be generated if you use certain Svelte component libraries that include scoped styles.

Since the `app.css` may not be generated, please manually add the `app.css` file in order to not get a 404 error if it's requested.

```sh
touch priv/static/assets/app.css
```

Since we renamed the Tailwind output file, we need to update our root Phoenix layout.

```diff
<!-- lib/app_web/components/layouts/root.html.heex -->
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="csrf-token" content={get_csrf_token()} />
  <.inertia_title><%= assigns[:page_title] %></.inertia_title>
  <.inertia_head content={@inertia_head} />
+ <link phx-track-static rel="stylesheet" href={~p"/assets/tailwind.css"} />
  <link phx-track-static rel="stylesheet" href={~p"/assets/app.css"} />
  <script defer phx-track-static type="text/javascript" src={~p"/assets/app.js"}>
  </script>
</head>
```

**Note:** If you're 100% sure you won't be using any scoped CSS styles in your Svelte components, you can also remove the `app.css` link from the root layout, but again, this is not suggested.

Lastly, since we are using Svelte, we also need to update the Tailwind configuration to include `.svelte` files.

```diff
// assets/tailwind.config.js
content: [
- "./js/**/*.js",
+ "./js/**/*.{js,svelte}",
  "../lib/app_web.ex",
  "../lib/app_web/**/*.*ex"
],
```

### Replace the `esbuild` watcher with the new build script

During development, we will use the `build.js` script to watch and build both our client and server bundles when changes are detected.

```diff
# config/dev.exs
config :my_app, MyAppWeb.Endpoint,
  # Binding to loopback ipv4 address prevents access from other machines.
  # Change to `ip: {0, 0, 0, 0}` to allow access from other machines.
  http: [ip: {127, 0, 0, 1}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "4Z2yyTu6Uy8AM+MguG3oldEf4aIdswR2BsCm1OtqDK0lEv++T02KktRaXfMbC/Zs",
  watchers: [
-   esbuild: {Esbuild, :install_and_run, [:app, ~w(--sourcemap=inline --watch)]},
+   node: ["build.js", "--watch", cd: Path.expand("../assets", __DIR__)],
+   node: ["build.js", "--watch", "--ssr", cd: Path.expand("../assets", __DIR__)],
    tailwind: {Tailwind, :install_and_run, [:my_app, ~w(--watch)]}
  ]
```

### Update aliases in `mix.exs`

Our aliases in `mix.exs` will also need to be updated to reflect the new `build.js` script.

```diff
# mix.exs
defp aliases do
  [
    setup: ["deps.get", "ecto.setup", "assets.setup", "assets.build"],
    "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
    "ecto.reset": ["ecto.drop", "ecto.setup"],
    test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
-   "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
-   "assets.build": ["tailwind app", "esbuild app"],
-   "assets.deploy": [
-     "tailwind app --minify",
-     "esbuild app --minify",
-     "phx.digest"
-   ]
+   "assets.setup": ["tailwind.install --if-missing", "cmd --cd assets npm install"],
+   "assets.build": [
+     "tailwind app",
+     "cmd --cd assets node build.js",
+     "cmd --cd assets node build.js --ssr"
+   ],
+   "assets.deploy": [
+     "tailwind app --minify",
+     "cmd --cd assets node build.js --deploy",
+     "cmd --cd assets node build.js --deploy --ssr",
+     "phx.digest"
+   ]
  ]
  end
```

### Update `.gitignore`

The `esbuild` build script will generate a `ssr.js` bundle into the `priv` directory. Since it's generated code, add it to your `.gitignore` file.

```diff
# .gitignore
+ # Ignore Node.js module for Inertia.js SSR
+ /priv/ssr.js
```

## Add the `Inertia.SSR` module to your application supervision tree

```diff
# lib/my_app/application.ex
defmodule MyApp.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      AppWeb.Telemetry,
      App.Repo,
      {DNSCluster, query: Application.get_env(:App, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: App.PubSub},
      # Start the Finch HTTP client for sending emails
      {Finch, name: App.Finch},
      # Start a worker by calling: App.Worker.start_link(arg)
      # {App.Worker, arg},

+     # Start the SSR process pool
+     # You must specify a `path` option to locate the directory where the `ssr.js` file lives.
+     {Inertia.SSR, path: Path.join([Application.app_dir(:app), "priv"])},

      # Start to serve requests, typically the last entry
      AppWeb.Endpoint,
    ]
```

### Update your Inertia Elixir configuration to enable SSR

```diff
# config/config.exs

config :inertia,
  endpoint: AppWeb.Endpoint,
  static_paths: ["/assets/app.js"],
  default_version: "1",
- ssr: false,
- raise_on_ssr_failure: true
+ ssr: true,
+ raise_on_ssr_failure: config_env() != :prod
```

**Note:** Changing the `raise_on_ssr_failure` option is optional. Here we are enabling it in development and test environments to help catch errors during SSR. In production, it is set to `false` to prevent crashes if an error occurs during SSR.

### Remove `esbuild` (the Elixir Wrapper)

Since we are using a custom `esbuild` build script, we can remove the Elixir wrapper for `esbuild`.

Remove the `esbuild` configuration.

```diff
# config/config.exs
- # Configure esbuild (the version is required)
- config :esbuild,
-   version: "0.17.11",
-   app: [
-     args:
-       ~w(js/app.js --bundle --target=es2017 --outdir=../priv/static/assets --external:/fonts/* --external:/images/*),
-     cd: Path.expand("../assets", __DIR__),
-     env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
-   ]
```

Remove the `esbuild` dependency.

```diff
# mix.exs
defp deps do
  [
    # ...
-   {:esbuild, "~> 0.8", runtime: Mix.env() == :dev},
    # ...
  ]
end
```

Unlock the `esbuild` dependency.

```sh
mix deps.unlock esbuild
```

## Create an example Inertia page

Now that we have everything set up, let's create an example page to test our setup!

### Create a new Svelte page component

Create a new Svelte component named `Home.svelte` in the `assets/js/pages` directory.

```svelte
<!-- assets/js/pages/Home.svelte -->
<script>
  export let name;
</script>

<h1>Hello from {name}!</h1>
```

### Render from a Phoenix Controller

Update the default Phoenix controller to render the `Home.svelte` component via Inertia.

```diff
# lib/app_web/controllers/page_controller.ex
defmodule AppWeb.PageController do
  use AppWeb, :controller

  def home(conn, _params) do
-    # The home page is often custom made,
-    # so skip the default app layout.
-    render(conn, :home, layout: false)
+    conn
+    |> assign(:page_title, "Home Page")
+    |> assign_prop(:name, "Phoenix + Inertia.js + Svelte")
+    |> render_inertia("Home")
  end
end
```

This concludes the basic setup guide. You should now have a working Phoenix project with Inertia.js and Svelte!

## Extra Setup (Optional)

Beyond the basic setup above, there is additional setup I like to add to all my projects such as TypeScript, Prettier, etc. **Note:** These are optional so only read on if you are interested!

If you would just like to learn how to deploy your app, you can skip to the [deployment](#deployment) section below.

### Switching from CommonJS to ESM

Switch from CommonJS to ESM for better compatibility with modern JavaScript packages.

Set `type` to `module` in `assets/package.json`.

```diff
// assets/package.json
{
+ "type": "module",
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  }
}
```

Remove topbar from vendor directory.

```sh
rm assets/vendor/topbar.js
```

Install topbar via `npm`.

```sh
npm --prefix assets install topbar
```

Update `topbar` import in `app.js`

```diff
// assets/js/app.js
- import topbar from "../vendor/topbar";
+ import topbar from "topbar";
```

Update the `esbuild` script imports to ESM.

```diff
// assets/build.js
- const esbuild = require("esbuild");
- const sveltePlugin = require("esbuild-svelte");
+ import esbuild from "esbuild";
+ import sveltePlugin from "esbuild-svelte";
```

### TypeScript

[TypeScript](https://www.typescriptlang.org/) is a typed superset of JavaScript that compiles to plain JavaScript. It provides static type-checking and better intellisense support.

Install dependencies.

```sh
npm --prefix assets install -D \
    @tsconfig/svelte \
    @types/node \
    @types/phoenix \
    @types/phoenix_live_view \
    svelte-check \
    tslib \
    typescript
```

Add a `tsconfig.json`.

```js
// assets/tsconfig.json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "importHelpers": true
  },
  "include": ["js/**/*.ts", "js/**/*.svelte"]
}
```

Update the `esbuild` build script to process TypeScript in Svelte files.

```diff
// assets/build.js
+ import sveltePreprocess from "svelte-preprocess";

const clientOpts = {
  // ...
  plugins: [
    sveltePlugin({
+     preprocess: sveltePreprocess(),
      compilerOptions: {
        dev: !deploy,
        hydratable: true,
        css: "external",
      },
    }),
  ],
};

const serverOpts = {
  // ...
  plugins: [
    sveltePlugin({
+     preprocess: sveltePreprocess(),
      compilerOptions: {
        dev: !deploy,
        hydratable: true,
        generate: "ssr",
        css: "none",
      },
    }),
  ],
};
```

Add `npm` scripts for type-checking.

```diff
// assets/package.json
{
  "type": "module",
+  "scripts": {
+    "check": "svelte-check --tsconfig ./tsconfig.json",
+    "check:watch": "svelte-check --tsconfig ./tsconfig.json --watch"
+  },
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  }
}
```

Update Tailwind configuration to include `.ts` files.

```diff
  content: [
-   "./js/**/*.{js,svelte}",
+   "./js/**/*.{js,ts,svelte}",
    "../lib/app_web.ex",
    "../lib/app_web/**/*.*ex"
  ],
```

## Path Aliases

Add path aliases to frequently used directories for easier imports.

```diff
// assets/tsconfig.json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    // ...
+   "baseUrl": ".",
+   "paths": {
+     "$lib/*": ["js/lib/*"],
+   }
  },
  "include": ["js/**/*.ts", "js/**/*.svelte"]
}
```

### Prettier

[Prettier](https://prettier.io/) is an opinionated code formatter for JavaScript projects.

Install dependencies.

```sh
npm --prefix assets install -D \
    @tailwindcss/forms \
    prettier \
    prettier-plugin-svelte \
    prettier-plugin-tailwindcss \
    tailwindcss
```

**Note:** The Tailwind dependencies are also included here, despite already being handled by the Elixir wrapper. This is to prevent errors when running Prettier since the it will read from the Tailwind configuration file.

Add a `.prettierrc` file.

```js
// assets/.prettierrc
{
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

Add scripts for formatting.

```diff
// assets/package.json
{
  "type": "module",
  "scripts": {
+   "lint": "prettier --check .",
+   "format": "prettier --write ."
  },
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  }
}
```

### ESLint

[ESLint](https://eslint.org/) is a linter that helps catch errors and enforce code style.

Install dependencies.

```sh
npm --prefix assets install -D \
    @types/eslint \
    eslint \
    eslint-config-prettier \
    eslint-plugin-svelte \
    globals \
    typescript-eslint
```

Add `eslint` configuration.

```js
// assets/eslint.config.js
import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  ...svelte.configs["flat/prettier"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
];
```

Add scripts for lint check.

```diff
// assets/package.json
{
  "type": "module",
  "scripts": {
    // ...
-   "lint": "prettier --check .",
+   "lint": "prettier --check . && eslint .",
    // ...
  },
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  }
}
```

### daisyUI

[daisyUI](https://daisyui.com/) is a set of utility classes that can be used with Tailwind CSS to speed up development.

Install dependencies.

```sh
npm --prefix assets install -D daisyui@latest
```

Add daisyUI to Tailwind configuration.

```js
// assets/tailwind.config.js
module.exports = {
  //...

  plugins: [
+   require("daisyui"),
  ],

+ // daisyUI config (optional - here are the default values)
+ daisyui: {
+   themes: false, // false: only light + dark | true: all themes | array: specific themes like this ["light", "dark", "cupcake"]
+   darkTheme: "dark", // name of one of the included themes for dark mode
+   base: true, // applies background color and foreground color for root element by default
+   styled: true, // include daisyUI colors and design decisions for all components
+   utils: true, // adds responsive and modifier utility classes
+   prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
+   logs: false, // Shows info about daisyUI version and used config in the console when building your CSS
+   themeRoot: ":root", // The element that receives theme color CSS variables
+ },

  //...
}
```

Remove `bg-white` class from root template. daisyUI handles setting the bg color.

```diff
<!-- lib/app_web/components/layouts/root.html.heex -->
-  <body class="bg-white antialiased">
+  <body class="antialiased">
```

### Font Awesome Icons

[Font Awesome](https://fontawesome.com/search?o=r&m=free) is a popular icon library that can be used with Svelte. The `svelte-fa` library is a wrapper around Font Awesome that makes it easy to use in Svelte components.

Install dependencies.

```sh
npm --prefix assets install -D \
    svelte-fa \
    @fortawesome/free-solid-svg-icons \
    @fortawesome/free-regular-svg-icons \
    @fortawesome/free-brands-svg-icons
```

#### Example Usage

```svelte
<script>
  import Fa from 'svelte-fa'
  import { faFlag } from '@fortawesome/free-solid-svg-icons'
  import { faGithub } from '@fortawesome/free-brands-svg-icons';
</script>

<Fa icon={faFlag} />
<Fa icon={faGithub} />
```

You can find full documentation for the `svelte-fa` library [here](https://github.com/Cweili/svelte-fa).

### Environment Variables

During development, it can be convenient to set environment variables in a `.env` file so it can be easily loaded.

Add a `.env` file to the root of your project.

```sh
touch .env
```

Update `.gitignore` to ignore the `.env` file.

```diff
+ # Ignore environment variables file
+ .env
```

Now you can easily add any variables you would like to the `.env` file and load the variables before starting the Phoenix server.

```sh
source .env && mix phx.server
```

### Local network development

During development, you may want to expose your Phoenix server to your local network so that you can test your application on other devices, such as on a mobile phone or tablet. Please ensure that you trust the devices on your local network before doing this.

```diff
# config/dev.exs
config :app, AppWeb.Endpoint,
- http: [ip: {127, 0, 0, 1}, port: 4000],
+ http: [ip: {0, 0, 0, 0}, port: 4000],
  # ...
```

### Credo

[Credo](https://github.com/rrrene/credo) is a static code analysis tool for the Elixir language with a focus on teaching and code consistency.

Add Credo to project dependencies.

```elixir
# mix.exs
defp deps do
  [
    {:credo, "~> 1.7", only: [:dev, :test], runtime: false}
  ]
end
```

Install dependencies.

```sh
mix deps.get
```

Generate a default configuration file.

```sh
mix credo gen.config
```

### Sobelow

[Sobelow](https://github.com/nccgroup/sobelow) is a security-focused static analysis tool for the Phoenix Framework.

Add Sobelow to project dependencies.

```elixir
# mix.exs
def deps do
  [
    {:sobelow, "~> 0.13", only: [:dev, :test], runtime: false}
  ]
end
```

Install dependencies.

```sh
mix deps.get
```

## Deployment

Deploying a Phoenix app with Inertia.js and Svelte is the same as deploying a regular Phoenix app, except that you will need to ensure that `nodejs` is installed in your production environment.

The below guide shows how to deploy to [Fly.io](https://fly.io/), but similar steps can be taken to deploy to other hosting providers.

You can find more information on how to deploy a Phoenix app [here](https://hexdocs.pm/phoenix/deployment.html).

### Deploying on Fly.io

The following steps are needed to deploy to Fly.io. Further guidance on how to deploy to Fly.io can be found [here](https://fly.io/docs/elixir/getting-started/).

1. Generate a `Dockerfile`:

```bash
mix phx.gen.release --docker
```

2. Modify the generated `Dockerfile` to install `curl`, which is used to install `nodejs`, and also add a step to install our `npm` dependencies:

```diff
# Dockerfile

...

# install build dependencies
- RUN apt-get update -y && apt-get install -y build-essential git \
+ RUN apt-get update -y && apt-get install -y build-essential git curl \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

+ # install nodejs for build stage
+ RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

...

COPY assets assets

+ # install all npm packages in assets directory
+ WORKDIR /app/assets
+ RUN npm install

+ # change back to build dir
+ WORKDIR /app

...

# start a new build stage so that the final image will only contain
# the compiled release and other runtime necessities
FROM ${RUNNER_IMAGE}

RUN apt-get update -y && \
-  apt-get install -y libstdc++6 openssl libncurses5 locales ca-certificates \
+  apt-get install -y libstdc++6 openssl libncurses5 locales ca-certificates curl \
   && apt-get clean && rm -f /var/lib/apt/lists/*_*

+ # install nodejs for production environment
+ RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

...
```

Note: `nodejs` is installed BOTH in the build stage and in the final image. This is because we need `nodejs` to install our `npm` dependencies and also need it when running our app (if we are using SSR).

3. Initialize and deploy the project. Fly will automatically detect the app type and set up the necessary configuration. You can tweak the settings when prompted or stick with the defaults.

```bash
fly launch
```

And that's it! Your Phoenix app with Inertia.js and Svelte is now deployed. :)
