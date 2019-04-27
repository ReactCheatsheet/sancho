import * as React from "react";

/**
 * The pan responder takes its inspiration from react-native's
 * pan-responder, and react-spring. Learn more about react-native's
 * system here:
 *
 * https://facebook.github.io/react-native/docs/gesture-responder-system.html
 *
 * Basic usage:
 *
 * const bind = usePanResponder({
 *  onStartShouldSet: () => true,
 *  onGrant: () => highlight(),
 *  onMove: () => updatePosition(),
 *  onRelease: () => unhighlight(),
 *  onTerminate: () => unhighlight()
 * })
 *
 * The main benefit this provides is the ability to reconcile
 * multiple gestures, and give priority to one.
 *
 * You can use a combination of useStartShouldSet, useStartShouldSetCapture,
 * onMoveShouldSetCapture, and onMoveShouldSet to dictate
 * which gets priority.
 *
 * Typically you'd want to avid capture since it's generally
 * preferable to have child elements gain touch access.
 */

interface Options {
  onStartShouldSetCapture?: (state: StateType) => boolean;
  onStartShouldSet?: (state: StateType) => boolean;
  onMoveShouldSetCapture?: (state: StateType) => boolean;
  onMoveShouldSet?: (state: StateType) => boolean;
  onGrant?: (state: StateType) => void;
  onMove?: (state: StateType) => void;
  onTerminationRequest?: (state: StateType) => boolean;
  onRelease?: (state: StateType) => void;
  onTerminate?: (state: StateType) => void;
}

const initialState = {
  event: undefined,
  target: undefined,
  time: Date.now(),
  xy: [0, 0],
  delta: [0, 0],
  initial: [0, 0],
  previous: [0, 0],
  direction: [0, 0],
  local: [0, 0],
  lastLocal: [0, 0],
  velocity: 0,
  distance: 0,
  down: false,
  first: true
};

type StateType = typeof initialState;

interface GrantedTouch {
  id: string | number;
  onTerminationRequest: () => boolean;
  onTerminate: () => void;
}

let grantedTouch: GrantedTouch | null = null;

export function usePanResponder(options: Options = {}, uid?: string) {
  const ref = React.useRef<any>(null);
  const state = React.useRef(initialState);
  const id = React.useRef(uid || Math.random());

  // potentially do?:
  // const optionsRef = React.useRef(options)
  // useEffect(() => { optionsRef.options = options }, [options])

  React.useEffect(() => {
    if (!ref.current) {
      throw new Error("Unable to find current ref");
    }

    const el = ref.current!;

    // todo: mouse events
    el.addEventListener("touchstart", handleStart, false);
    el.addEventListener("touchend", handleEnd);
    el.addEventListener("touchmove", handleMove, false);
    el.addEventListener("touchstart", handleStartCapture, true);
    el.addEventListener("touchmove", handleMoveCapture, true);

    return () => {
      el.removeEventListener("touchstart", handleStart, false);
      el.removeEventListener("touchend", handleEnd);
      el.removeEventListener("touchmove", handleMove, false);
      el.removeEventListener("touchstart", handleStartCapture, true);
      el.removeEventListener("touchmove", handleMoveCapture, true);
    };
  }, []);

  function claimTouch(e: Event) {
    if (grantedTouch) {
      grantedTouch.onTerminate();
      grantedTouch = null;
    }

    attemptGrant(e);
  }

  function attemptGrant(e: Event) {
    // if a touch is already active we won't register
    if (grantedTouch) {
      return;
    }

    grantedTouch = {
      id: id.current,
      onTerminate,
      onTerminationRequest
    };

    state.current = {
      ...state.current,
      first: true
    };

    onGrant(e);
  }

  function handleStartCapture(e: Event) {
    const granted = onStartShouldSetCapture();
    if (granted) {
      attemptGrant(e);
    }
  }

  function handleStart(e: Event) {
    if (e.cancelable) {
      e.preventDefault();
    }

    const granted = onStartShouldSet();

    if (granted) {
      attemptGrant(e);
    }
  }

  function isGrantedTouch() {
    return grantedTouch && grantedTouch.id === id.current;
  }

  function handleEnd(e: Event) {
    if (!isGrantedTouch()) {
      return;
    }

    // remove touch
    grantedTouch = null;

    state.current = {
      ...state.current,
      first: false
    };

    if (e.cancelable) {
      e.preventDefault();
    }

    onRelease(e);
  }

  function handleMoveCapture(e: Event) {
    if (!isGrantedTouch()) {
      const grant = onMoveShouldSetCapture();
      if (grant) claimTouch(e);
      else return;
    }

    onMove(e);
  }

  function handleMove(e: Event) {
    if (!isGrantedTouch()) {
      const grant = onMoveShouldSet();
      // console.log("should focus?", id.current, grant);
      if (grant) {
        claimTouch(e);
      } else {
        return;
      }
    }

    onMove(e);
  }

  function onStartShouldSetCapture() {
    return options.onStartShouldSetCapture
      ? options.onStartShouldSetCapture(state.current)
      : false;
  }

  function onStartShouldSet() {
    return options.onStartShouldSet
      ? options.onStartShouldSet(state.current)
      : false;
  }

  function onMoveShouldSet() {
    return options.onMoveShouldSet
      ? options.onMoveShouldSet(state.current)
      : false;
  }

  function onMoveShouldSetCapture() {
    return options.onMoveShouldSetCapture
      ? options.onMoveShouldSetCapture(state.current)
      : false;
  }

  function onGrant(e: any) {
    const { target, pageX, pageY } = e.touches ? e.touches[0] : e;
    const s = state.current;
    state.current = {
      ...state.current,
      event: e,
      target,
      lastLocal: s.lastLocal || initialState.lastLocal,
      xy: [pageX, pageY],
      initial: [pageX, pageY],
      previous: [pageX, pageY],
      down: true,
      time: Date.now()
    };
    if (options.onGrant) {
      options.onGrant(state.current);
    }
  }

  function onMove(e: any) {
    const { pageX, pageY } = e.touches ? e.touches[0] : e;
    const s = state.current;
    const time = Date.now();
    const x_dist = pageX - s.xy[0];
    const y_dist = pageY - s.xy[1];
    const delta_x = pageX - s.initial[0];
    const delta_y = pageY - s.initial[1];
    const distance = Math.sqrt(delta_x * delta_x + delta_y * delta_y);
    const len = Math.sqrt(x_dist * x_dist + y_dist * y_dist);
    const scaler = 1 / (len || 1);
    const velocity = len / (time - s.time);

    state.current = {
      ...state.current,
      event: e,
      time,
      xy: [pageX, pageY],
      delta: [delta_x, delta_y],
      local: [
        s.lastLocal[0] + pageX - s.initial[0],
        s.lastLocal[1] + pageY - s.initial[1]
      ],
      velocity: time - s.time === 0 ? s.velocity : velocity,
      distance,
      direction: [x_dist * scaler, y_dist * scaler],
      previous: s.xy,
      first: false
    };

    if (options.onMove) {
      options.onMove(state.current);
    }
  }

  function onTerminationRequest() {
    return options.onTerminationRequest
      ? options.onTerminationRequest(state.current)
      : true;
  }

  function onRelease(e: any) {
    const s = state.current;
    state.current = {
      ...state.current,
      event: e,
      lastLocal: s.local
    };

    if (options.onRelease) {
      options.onRelease(state.current);
    }
  }

  function onTerminate() {
    const s = state.current;
    state.current = {
      ...state.current,
      event: undefined,
      lastLocal: s.local
    };

    if (options.onTerminate) {
      options.onTerminate(state.current);
    }
  }

  return {
    ref
  };
}