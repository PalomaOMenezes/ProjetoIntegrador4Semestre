from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from schemas import SolicitacaoCreate, SolicitacaoResponse
from database import engine, Base, get_db
from models import SolicitacaoAgendamento

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa as tabelas do banco de dados na inicialização
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup (opcional) no encerramento

app = FastAPI(title="SmileClinic Backend API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if errors:
        first_error = errors[0]
        field = first_error["loc"][-1]
        msg = first_error["msg"]
        message = f"Erro no campo {field}: {msg}"
    else:
        message = "Erro de validação nos dados enviados."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"message": message},
    )

@app.post("/solicitacoes", status_code=status.HTTP_201_CREATED, response_model=SolicitacaoResponse)
async def criar_solicitacao(
    solicitacao: SolicitacaoCreate,
    db: AsyncSession = Depends(get_db)
):
    nova_solicitacao = SolicitacaoAgendamento(
        nome=solicitacao.nome,
        email=solicitacao.email,
        telefone=solicitacao.telefone,
        servico=solicitacao.servico.value,
        mensagem=solicitacao.mensagem,
    )
    db.add(nova_solicitacao)
    await db.commit()
    await db.refresh(nova_solicitacao)

    return SolicitacaoResponse(
        id=nova_solicitacao.id,
        status=nova_solicitacao.status,
        message="Solicitação enviada com sucesso"
    )
