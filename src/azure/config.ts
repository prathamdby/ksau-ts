export function parseRcloneConfigData(data: Uint8Array): Map<string, string>[] {
  const content = new TextDecoder().decode(data);
  const lines = content.split("\n");
  const configMaps: Map<string, string>[] = [];
  let configMap = new Map<string, string>();

  for (let linenum = 0; linenum < lines.length; linenum++) {
    const line = lines[linenum].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      if (configMap.size > 0) {
        configMaps.push(configMap);
        configMap = new Map<string, string>();
      }
      const currentSection = line.slice(1, -1);
      configMap.set("remote_name", currentSection);
      continue;
    }

    const parts = splitN(line, "=", 2);
    if (parts.length === 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      configMap.set(key, value);
    } else if (parts.length === 1) {
      const key = parts[0].trim();
      configMap.set(key, "");
    } else {
      throw new Error(`error parsing line ${linenum} of rclone config`);
    }
  }

  configMaps.push(configMap);
  return configMaps;
}

function splitN(str: string, sep: string, n: number): string[] {
  const idx = str.indexOf(sep);
  if (n === 2 && idx !== -1) {
    return [str.slice(0, idx), str.slice(idx + sep.length)];
  }
  return [str];
}

export function getAvailableRemotes(configs: Map<string, string>[]): string[] {
  return configs.map((c) => c.get("remote_name") ?? "");
}

export function getRemoteConfig(
  configs: Map<string, string>[],
  remoteName: string
): Map<string, string> {
  const available = getAvailableRemotes(configs);

  if (!available.includes(remoteName)) {
    throw new Error(`remote ${remoteName} does not exist`);
  }

  for (const elem of configs) {
    for (const key of elem.keys()) {
      if (key === remoteName) {
        return elem;
      }
    }
  }

  throw new Error("this shouldn't be reachable(?)");
}
