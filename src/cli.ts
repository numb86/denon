// Copyright 2020-present the denosaurs team. All rights reserved. MIT license.

import {
  log,
  yellow,
  bold,
  gray,
  blue,
  reset,
  setColorEnabled,
  grant,
  exists,
  omelette,
} from "../deps.ts";

import { DenonConfig, writeConfig, getConfigFilename } from "./config.ts";
import { Runner } from "./runner.ts";
import { VERSION } from "../denon.ts";

/**
 * These are the permissions required for a clean run
 * of `denon`. If not provided through installation they 
 * will be asked on every run by the `grant()` std function.
 * 
 * The permissions required are:
 * - *read*, used to correctly load a configuration file and
 * to monitor for filesystem changes in the directory `denon`
 * is executed to reload scripts.
 * - *run*, used to run scripts as child processes.
 */
const PERMISSIONS: Deno.PermissionDescriptor[] = [
  { name: "read" },
  { name: "run" },
];

/**
 * These permissions are required on specific situations,
 * `denon` should not be installed with this permissions
 * but you should be granting them when they are required.
 */
const PERMISSION_OPTIONAL: { [key: string]: Deno.PermissionDescriptor[] } = {
  write: [{ name: "write" }],
};

export async function grantPermissions() {
  // @see PERMISSIONS .
  let permissions = await grant([...PERMISSIONS]);
  if (!permissions || permissions.length < 2) {
    log.critical("Required permissions `read` and `run` not granted");
    Deno.exit(1);
  }
}

/**
 * Create configuration file in the root of current work directory.
 * // TODO: make it interactive
 */
export async function initializeConfig() {
  let permissions = await grant(PERMISSION_OPTIONAL.write);
  if (!permissions || permissions.length < 1) {
    log.critical("Required permissions `write` not granted");
    Deno.exit(1);
  }
  const file = "denon.json";
  if (!await exists(file)) {
    log.info("creating json configuration...");
    try {
      await writeConfig(file);
    } catch (_) {
      log.error("`denon.json` cannot be saved in root dir");
    }
    log.info("`denon.json` created correctly in root dir");
  } else {
    log.error("`denon.json` already exists in root dir");
  }
}

/**
 * Grab a fresh copy of denon
 */
export async function upgrade(version?: string) {
  const url = `https://deno.land/x/denon${version ? `@${version}` : ""}/denon.ts`;

  if (version === VERSION) {
    log.info(`Version ${version} already installed`);
    Deno.exit(0);
  }

  log.debug(`Checking if ${url} exists`);
  if ((await fetch(url)).status !== 200) {
    log.critical(`Upgrade url ${url} does not exist`);
    Deno.exit(1);
  }

  log.info(
    `Running \`deno install -Af --unstable ${url}\``,
  );
  await Deno.run({
    cmd: [
      "deno",
      "install",
      "--allow-read",
      "--allow-run",
      "--allow-write",
      "-f",
      "--unstable",
      url,
    ],
    stdout: undefined,
  }).status();
  Deno.exit(0);
}

/**
 * Generate autocomplete suggestions
 */
export function autocomplete(config: DenonConfig) {
  // Write your CLI template.
  const completion = omelette.default(`denon <script>`);

  // Bind events for every template part.
  completion.on("script", function ({ reply }: { reply: Function }) {
    const auto = Object.keys(config.scripts);
    for (const file of Deno.readDirSync(Deno.cwd())) {
      auto.push(file.name);
    }
    reply(auto);
  });

  completion.init();
}

/**
 * List all available scripts declared in the config file.
 * // TODO: make it interactive
 */
export function printAvailableScripts(config: DenonConfig) {
  if (Object.keys(config.scripts).length) {
    log.info("available scripts:");
    const runner = new Runner(config);
    for (const name of Object.keys(config.scripts)) {
      const script = config.scripts[name];
      console.log();
      console.log(` - ${yellow(bold(name))}`);

      if (typeof script === "object" && script.desc) {
        console.log(`   ${script.desc}`);
      }

      console.log(gray(`   $ ${runner.build(name).cmd.join(" ")}`));
    }
    console.log();
    console.log(
      `You can run scripts with \`${blue("denon")} ${yellow("<script>")}\``,
    );
  } else {
    log.error("It looks like you don't have any scripts...");
    const config = getConfigFilename();
    if (config) {
      log.info(
        `You can add scripts to your \`${config}\` file. Check the docs.`,
      );
    } else {
      log.info(
        `You can create a config to add scripts to with \`${blue("denon")} ${
          yellow("--init")
        }${reset("\`.")}`,
      );
    }
  }
}

/**
 * Help message to be shown if `denon`
 * is run with `--help` flag.
 */
export function printHelp(version: string) {
  setColorEnabled(true);
  console.log(
    `${blue("DENON")} - ${version}
Monitor any changes in your Deno application and automatically restart.

Usage:
    ${blue("denon")} ${yellow("<script name>")}     ${
      gray("-- eg: denon start")
    }
    ${blue("denon")} ${yellow("<command>")}         ${
      gray("-- eg: denon run helloworld.ts")
    }
    ${blue("denon")} [options]         ${gray("-- eg: denon --help")}

Options:
    -h --help               Show this screen.
    -v --version            Show version.
    -i --init               Create config file in current working dir.
    -u --upgrade <version>  Upgrade to latest version. (default: master)
    -c --config <file>      Use specific file as configuration.
`,
  );
}
