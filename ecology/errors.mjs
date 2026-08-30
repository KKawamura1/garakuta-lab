// ecology/errors.mjs
//
// §4.1 and §14: bad content, event caps, free cycles and unimplemented effects
// throw instead of returning a partial result, and the throw carries enough of
// the causal state to find the loop without re-running the battle.

export class EcologyValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = "EcologyValidationError";
    this.errors = errors;
  }
}

export class EcologyRuntimeError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = "EcologyRuntimeError";
    Object.assign(this, diagnostics);
    this.diagnostics = diagnostics;
  }
}

export function formatValidationErrors(errors) {
  return errors.map((error) => `${error.path}: [${error.code}] ${error.message}`).join("\n");
}

