import { Var, Const, Derived } from "../value";
import { ReactiveState } from "./builder";
import type { Dict } from "../utils";
import { Debuggable, DEBUG, Structured, newtype, description } from "../debug";

export type ReactiveDict<
  R extends ReactiveParameters
  > = R extends ReactiveParameters<infer R> ? R : never;

export function constant<T>(value: T): Param<T> {
  return reactive(() => Const(value), "const");
}

export function call<A extends Var[], B>(
  call: UserCall<A, B>,
  ...inputs: ReactiveParametersForValues<A>
): Param<B> {
  return reactive(state => {
    let hydratedInputs = inputs.map(input => input.hydrate(state)) as A;
    return Derived(() => call(...hydratedInputs));
  }, "call");
}

export function callEffect<A extends Var[], B>(
  call: UserCall<A, B>,
  ...inputs: ReactiveParametersForValues<A>
): Param<B> {
  return reactive(state => {
    let hydratedInputs = inputs.map(input => input.hydrate(state)) as A;
    return Derived(() => call(...hydratedInputs));
  }, "call");
}

export class ReactiveParameters<
  D extends Dict<Param> = Dict<Param>
  > {
  static for<D extends Dict<Param>>(
    input: ReactiveInputs<D>
  ): ReactiveParameters<D> {
    let dict: Dict = {};
    for (let [key, value] of Object.entries(input)) {
      dict[key] = value(key);
    }

    return new ReactiveParameters(dict as D);
  }

  #params: D;

  constructor(params: D) {
    this.#params = params;
  }

  get dict(): D {
    return this.#params;
  }

  get<K extends keyof D>(key: K): D[K] {
    if (key in this.#params) {
      return this.#params[key] as D[K];
    } else {
      let param = reactive(
        state => state.dynamic[key as string],
        "dynamic"
      ) as D[K];

      this.#params[key] = param;
      return param;
    }
  }

  hydrate(dict: DynamicRuntimeValues<D>): ReactiveState {
    return new ReactiveState(dict);
  }
}

export function Param<T>(): (key: string) => Param<T> {
  return key =>
    reactive(
      state => state.dynamic[key as string],
      "dynamic"
    ) as Param<T>;
}

export interface Param<T = unknown> extends Debuggable {
  hydrate(state: ReactiveState): Var<T>;
}

let ID = 0;

function reactive<T>(
  callback: (state: ReactiveState) => Var<T>,
  kind: string
): Param<T> {
  return {
    [DEBUG](): Structured {
      return newtype("reactive", description(`${kind}(${ID++})`));
    },
    hydrate(state: ReactiveState): Var<T> {
      return callback(state);
    },
  };
}

export type ReactiveInput<T extends Param> = (key: string) => T;
export type ReactiveInputs<T extends Dict<Param>> = {
  [P in keyof T]: ReactiveInput<T[P]>;
};

export type ReactiveParametersForTuple<T extends readonly Var<unknown>[]> = {
  [P in keyof T]: T[P] extends Var<infer R> ? Param<R> : never;
};

export type ReactiveValuesForTuple<
  T extends readonly Param<unknown>[]
  > = {
    [P in keyof T]: T[P] extends Param<infer R> ? Var<R> : never;
  };

export type ReactiveParametersForInputs<
  I extends ReactiveInputs<Dict<Param>>
  > = I extends ReactiveInputs<infer R> ? ReactiveParameters<R> : never;

type UserCall<A extends Var[], B> = (...args: A) => B;

type ReactiveParameterForValue<V extends Var> = V extends Var<infer R>
  ? Param<R>
  : never;

type ReactiveParametersForValues<A extends Var[]> = {
  [P in keyof A]: A[P] extends Var ? ReactiveParameterForValue<A[P]> : never;
};

export type RuntimeValuesForDict<D extends Dict<Param>> = {
  [P in keyof D]: D[P] extends Param<infer R> ? Var<R> : never;
};

export type DynamicRuntimeValues<
  D extends Dict<Param> | ReactiveParameters
  > = D extends ReactiveParameters<infer D>
  ? RuntimeValuesForDict<D>
  : D extends Dict<Param>
  ? RuntimeValuesForDict<D>
  : never;
