"""Hash de senha (PBKDF2-SHA256) e autenticação JWT (HS256) sem dependências extras."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

ALGORITMO: str = "pbkdf2_sha256"
ITERACOES: int = 600_000
JWT_SECRET: str = os.getenv("JWT_SECRET", "smileclinic-dev-secret-change-in-prod")
JWT_EXPIRACAO_SEGUNDOS: int = int(os.getenv("JWT_EXP_SECONDS", str(60 * 60 * 24)))

_bearer_scheme = HTTPBearer(auto_error=False)


def gerar_hash(senha: str) -> str:
    """Gera hash PBKDF2-SHA256 com salt aleatório de 16 bytes."""
    salt = secrets.token_bytes(16)
    chave = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, ITERACOES)
    return f"{ALGORITMO}${ITERACOES}${salt.hex()}${chave.hex()}"


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Compara senha em texto puro com o hash armazenado em tempo constante."""
    try:
        algoritmo, iteracoes, salt_hex, chave_hex = senha_hash.split("$")
    except ValueError:
        return False
    if algoritmo != ALGORITMO:
        return False
    chave = hashlib.pbkdf2_hmac(
        "sha256", senha.encode(), bytes.fromhex(salt_hex), int(iteracoes)
    )
    return hmac.compare_digest(chave.hex(), chave_hex)


def _b64url_encode(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _b64url_decode(texto: str) -> bytes:
    padding = "=" * (-len(texto) % 4)
    return base64.urlsafe_b64decode(texto + padding)


def criar_token_jwt(
    dentista_id: int,
    email: str,
    expira_em_segundos: int | None = None,
) -> str:
    """Emite um JWT HS256 assinado contendo id, e-mail e expiração."""
    agora = int(time.time())
    duracao = (
        JWT_EXPIRACAO_SEGUNDOS if expira_em_segundos is None else expira_em_segundos
    )
    cabecalho = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(dentista_id),
        "email": email,
        "iat": agora,
        "exp": agora + duracao,
    }
    h_b64 = _b64url_encode(json.dumps(cabecalho, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    assinatura = hmac.new(
        JWT_SECRET.encode("utf-8"),
        f"{h_b64}.{p_b64}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{h_b64}.{p_b64}.{_b64url_encode(assinatura)}"


def decodificar_token_jwt(token: str) -> dict[str, Any]:
    """Valida assinatura e expiração do JWT; lança ValueError se inválido."""
    partes = token.split(".")
    if len(partes) != 3:
        raise ValueError("Token malformado.")
    h_b64, p_b64, sig_b64 = partes
    assinatura_esperada = _b64url_encode(
        hmac.new(
            JWT_SECRET.encode("utf-8"),
            f"{h_b64}.{p_b64}".encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    if not hmac.compare_digest(sig_b64, assinatura_esperada):
        raise ValueError("Assinatura do token inválida.")
    try:
        payload: dict[str, Any] = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    except Exception as exc:
        raise ValueError("Payload do token inválido.") from exc
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise ValueError("Token expirado.")
    if "sub" not in payload:
        raise ValueError("Token sem identificador.")
    return payload


async def exigir_autenticacao(
    credenciais: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict[str, Any]:
    """Dependência FastAPI que exige cabeçalho Authorization: Bearer <jwt>."""
    if credenciais is None or credenciais.scheme.lower() != "bearer":
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Autenticação necessária. Faça login novamente.",
        )
    try:
        return decodificar_token_jwt(credenciais.credentials)
    except ValueError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Sessão inválida ou expirada. Faça login novamente.",
        )
