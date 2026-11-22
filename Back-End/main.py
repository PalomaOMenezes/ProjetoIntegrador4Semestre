"""Ponto de entrada da API FastAPI do Sistema de Gestão Odontológica."""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from controllers import (
    configuracoes,
    consultas,
    dashboard,
    dentistas,
    evolucoes,
    financeiro,
    pacientes,
    prontuarios,
    solicitacoes,
    tratamentos,
)
from database import AsyncSessionLocal, Base, engine, garantir_colunas_legado
from seed import popular_dados_exemplo


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Cria tabelas novas, garante colunas legado e popula demo na Vercel."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(garantir_colunas_legado)
    if os.getenv("VERCEL") or os.getenv("AUTO_SEED") == "1":
        async with AsyncSessionLocal() as db:
            await popular_dados_exemplo(db)
    yield


app = FastAPI(
    title="SmileClinic Backend API",
    description=(
        "API do Sistema de Gestão Odontológica: recepção, prontuário eletrônico, "
        "odontograma, financeiro e dashboard gerencial."
    ),
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def erro_validacao(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Padroniza erros de validação Pydantic em {"message": "..."}."""
    errors = exc.errors()
    if errors:
        primeiro = errors[0]
        campo = primeiro["loc"][-1]
        texto = primeiro["msg"].removeprefix("Value error, ")
        message = f"Erro no campo {campo}: {texto}"
    else:
        message = "Erro de validação nos dados enviados."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"message": message},
    )


@app.exception_handler(HTTPException)
async def erro_http(_request: Request, exc: HTTPException) -> JSONResponse:
    """Padroniza exceções HTTP em {"message": "..."}."""
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.get("/health", tags=["Sistema"])
async def health() -> dict[str, str]:
    """Verificação de disponibilidade da API."""
    return {"status": "ok"}


app.include_router(solicitacoes.router)
app.include_router(dentistas.auth_router)
app.include_router(dentistas.router)
app.include_router(pacientes.router)
app.include_router(consultas.router)
app.include_router(prontuarios.router)
app.include_router(evolucoes.router)
app.include_router(tratamentos.planos_router)
app.include_router(tratamentos.documentos_router)
app.include_router(financeiro.router)
app.include_router(dashboard.router)
app.include_router(configuracoes.router)
