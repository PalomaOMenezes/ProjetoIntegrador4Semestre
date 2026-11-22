"""Controller das configurações gerais da clínica."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ConfiguracaoClinica
from schemas import ConfiguracaoResponse, ConfiguracaoUpdate
from security import exigir_autenticacao

router = APIRouter(
    prefix="/configuracoes",
    tags=["Configurações"],
    dependencies=[Depends(exigir_autenticacao)],
)


async def obter_ou_criar_configuracao(db: AsyncSession) -> ConfiguracaoClinica:
    """Retorna o registro único de configuração (id=1), criando padrão se faltar."""
    config = await db.get(ConfiguracaoClinica, 1)
    if config is None:
        config = ConfiguracaoClinica(id=1)
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


@router.get("", response_model=ConfiguracaoResponse)
async def obter_configuracoes(
    db: AsyncSession = Depends(get_db),
) -> ConfiguracaoClinica:
    """Retorna os parâmetros atuais da unidade."""
    return await obter_ou_criar_configuracao(db)


@router.patch("", response_model=ConfiguracaoResponse)
async def atualizar_configuracoes(
    dados: ConfiguracaoUpdate, db: AsyncSession = Depends(get_db)
) -> ConfiguracaoClinica:
    """Atualiza os parâmetros gerais da clínica."""
    config = await obter_ou_criar_configuracao(db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(config, campo, valor)
    await db.commit()
    await db.refresh(config)
    return config
