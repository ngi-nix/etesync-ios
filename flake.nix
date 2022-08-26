{
  description = "Etesync on iOS with Nix";
  inputs.nixpkgs.url = "nixpkgs/nixos-22.05";
  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      packages.${system} = {
        simulator = import ./nix/ios-simulator.nix { inherit pkgs; };
      };
    };
}
