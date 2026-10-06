import React, { createContext, useContext } from 'react';
import { FPS } from './theme';

/**
 * Scenes are authored in "planned seconds". When a voiceover makes a scene longer, its
 * timeline stretches: `t(seconds)` maps a planned moment to a frame of the actual scene.
 */
interface SceneTime {
  planned: number;
  frames: number;
}

const Ctx = createContext<SceneTime>({ planned: 1, frames: FPS });

export const SceneTiming: React.FC<SceneTime & { children: React.ReactNode }> = ({ children, ...v }) => <Ctx.Provider value={v}>{children}</Ctx.Provider>;

export function useT(): (sec: number) => number {
  const { planned, frames } = useContext(Ctx);
  return (sec) => Math.round((sec / planned) * frames);
}

export function useSceneFrames(): number {
  return useContext(Ctx).frames;
}
