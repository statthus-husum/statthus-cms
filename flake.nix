{
  description = "statthus-cms — Tina CMS (Next.js / Node); full stack runs via docker-compose";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";
  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_22 ]; # npm-based (package-lock.json); compose handles the full stack
        };
      });
}
