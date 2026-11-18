import type {
  VersionResolver,
  VersionResolverContext,
} from "@kubekpanel/blueprint-sdk";

const apiHost = ["api", "github", "com"].join(".");
const dlHost = ["github", "com"].join(".");
const repoName = ["open", "mp"].join(".");

const API_URL = `https://${apiHost}/repos/openmultiplayer/${repoName}/releases`;
const DL_BASE = `https://${dlHost}/openmultiplayer/${repoName}/releases/download`;

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: GithubAsset[];
}

async function fetchReleases(
  ctx: VersionResolverContext,
): Promise<GithubRelease[]> {
  const res = await ctx.fetch(API_URL, {
    headers: {
      "User-Agent": "Kubek",
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid response from GitHub API");
  }

  return (data as GithubRelease[]).filter((r) => !r.draft && !r.prerelease);
}

const resolver: VersionResolver = {
  async listVersions(ctx) {
    const releases = await fetchReleases(ctx);
    return releases.map((r) => ({
      id: r.tag_name,
      label: `open.mp ${r.tag_name}`,
    }));
  },

  async resolveDownload(version, ctx) {
    if (ctx) {
      try {
        const releases = await fetchReleases(ctx);
        const targetRelease =
          version === "latest"
            ? releases[0]
            : releases.find((r) => r.tag_name === version);

        const asset = targetRelease?.assets.find(
          (a) => a.name.includes("linux") && a.name.endsWith(".tar.gz"),
        );

        if (asset) {
          return {
            url: asset.browser_download_url,
            unpack: true,
          };
        }
      } catch {
        // Fallback к прямой ссылке при лимите API или сетевой ошибке
      }
    }

    return {
      url: `${DL_BASE}/${version}/open.mp-linux-x86-dynssl.tar.gz`,
      unpack: true,
    };
  },
};

export default resolver;