import { PASSWORD_MIN_LENGTH } from "@nextgen/auth/password-rules";

/** Os dois campos de senha, iguais em definir e em redefinir — o erro de digitar duas vezes. */
export function PasswordFields({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <>
      <div className="field">
        <label htmlFor="password">Nova senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
          autoFocus={autoFocus}
          placeholder={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`}
        />
      </div>

      <div className="field">
        <label htmlFor="confirmation">Repita a senha</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
          placeholder="Igual à de cima"
        />
      </div>

      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
        Mínimo de {PASSWORD_MIN_LENGTH} caracteres. Uma frase curta que só você saiba vale
        mais que uma palavra com símbolos no fim.
      </p>
    </>
  );
}
