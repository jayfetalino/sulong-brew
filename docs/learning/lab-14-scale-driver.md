# LAB-14: scale drivers (interface and a demo scale)

## What was built

- In `packages/drivers`: a `Scale` interface (what any scale must do) and a `SimulatedScale` that pretends to be one.
- The simulated scale can have a weight put on it, can tare (zero itself), and can "pour": its weight rises smoothly to a target over a time, like water filling a server.
- A shared **contract test** for scales, which the simulated scale passes and the real DiFluid Microbalance Ti driver will have to pass later.

## Key ideas

- **A stream, not a question.** The refractometer is asked for one reading. A scale sends weights continuously, many times a second. So a scale has `onWeight(listener)`, and you must stop listening when you leave a screen.
- **Tare changes what you see, not what is there.** The simulated scale remembers the real weight and the "zero" separately, just as a real scale does. A recipe's "pour to 220 g" means 220 g on the display after tare.
- **Weights can be negative.** Lift the server off after a tare and the display goes below zero. That is normal, so it is not treated as an error. Only a number that is not a number at all is refused.
- **A broken listener must not break the stream.** One screen's bug cannot stop the others from getting weights, and the contract test checks it.
- **Tests control time.** The pour tests use a clock the test moves by hand, so "after 4 seconds the weight is 20 g" is exact, with no waiting.
- **Same pattern as the refractometer.** Interface, labelled simulated device, shared contract test, and the real driver only from documented values.

## Remember

Anything the simulated scale produces is demo data. The live pour guide must say so, and demo weights must never be saved as real measurements.
