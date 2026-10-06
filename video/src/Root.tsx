import React from 'react';
import { Composition } from 'remotion';
import { Demo, sceneTiming, type DemoProps } from './Demo';
import { SCENES } from './scenes';
import { FPS } from './theme';
import { SceneTiming } from './timing';

const defaults: DemoProps = { timing: [], captions: true };

export const Root: React.FC = () => (
  <>
    <Composition
      id="Demo"
      component={Demo}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={defaults}
      calculateMetadata={async ({ props }) => {
        const timing = await sceneTiming();
        return { durationInFrames: timing.reduce((n, t) => n + t.frames, 0), props: { ...props, timing } };
      }}
    />
    {SCENES.map((s) => (
      <Composition key={s.id} id={s.id} width={1920} height={1080} fps={FPS} durationInFrames={s.planned * FPS} component={() => <SceneTiming planned={s.planned} frames={s.planned * FPS}>{s.render()}</SceneTiming>} />
    ))}
  </>
);
