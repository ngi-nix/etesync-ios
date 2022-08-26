{ pkgs }:

pkgs.xcodeenv.buildApp {
  name = "EteSync";
  src = ../ios;
  sdkVersion = "11.2";
}
