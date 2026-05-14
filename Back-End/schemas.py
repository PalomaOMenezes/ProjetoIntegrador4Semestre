from pydantic import BaseModel, EmailStr, Field
from enum import Enum
from typing import Optional
import uuid


class ServicoEnum(str, Enum):
    primeira_consulta = "primeira-consulta"
    limpeza = "limpeza"
    emergencia = "emergencia"
    ortodontia = "ortodontia"
    clareamento = "clareamento"
    implante = "implante"
    outro = "outro"


class SolicitacaoCreate(BaseModel):
    nome: str = Field(..., min_length=3)
    email: EmailStr
    telefone: str = Field(..., min_length=10, max_length=20)
    servico: ServicoEnum
    mensagem: Optional[str] = Field(None, max_length=500)


class SolicitacaoResponse(BaseModel):
    id: uuid.UUID
    status: str
    message: str
