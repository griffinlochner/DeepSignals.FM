import type { ComponentType } from "react";
import type { ThemeDefinition, ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "./ImageDepthThemeScene";
import { imageDepthEnvironmentCatalog } from "./environmentCatalog";
import "./imageDepthThemeSkins.css";

function createImageDepthScene(
  environmentId: string,
): ComponentType<ThemeSceneProps> {
  const registration = imageDepthEnvironmentCatalog.find(
    (environment) => environment.id === environmentId,
  );

  if (!registration) {
    throw new Error(
      `Missing image-depth registration for environment ${environmentId}.`,
    );
  }

  const sceneId = registration.id;
  const sceneBackdrop = registration.sceneBackdrop;
  const asset = registration.asset;
  const scenePreset = registration.productionScenePreset;

  function CatalogBackedImageDepthScene(props: ThemeSceneProps) {
    return (
      <ImageDepthThemeScene
        {...props}
        sceneId={sceneId}
        sceneBackdrop={sceneBackdrop}
        asset={asset}
        scenePreset={scenePreset}
        className="image-depth-theme-scene"
      />
    );
  }

  return CatalogBackedImageDepthScene;
}

export const imageDepthThemeDefinitions: ThemeDefinition[] =
  imageDepthEnvironmentCatalog.map((environment) => ({
    id: environment.id,
    name: environment.displayName,
    description: environment.description,
    className: `theme-${environment.id} image-depth-theme skin-${environment.uiSkin}`,
    performanceTier: "enhanced",
    Scene: createImageDepthScene(environment.id),
    supportsChroma: true,
    supportsMotion: true,
    supportsVisualFeed: true,
    supportsAudioReactiveBehavior: true,
  }));
