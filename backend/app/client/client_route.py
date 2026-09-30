from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.client.client_controller import (
    create_client_controller,
    get_client_controller,
    list_clients_controller,
    update_client_max_users_controller,
    update_client_status_controller,
)
from app.client.client_schema import (
    ClientCreateRequest,
    ClientListResponse,
    ClientResponse,
    ClientUpdateMaxUsersRequest,
    ClientUpdateStatusRequest,
)
from app.core.database import get_db
from app.core.roles import SUPERADMIN_ROLE
from app.dependencies.auth import require_roles

router = APIRouter(
    prefix="/api/v1/clients",
    tags=["Client Management (SuperAdmin)"],
    dependencies=[Depends(require_roles([SUPERADMIN_ROLE]))],
)


@router.post(
    "",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new client company with initial Client Admin",
)
@router.post(
    "/",
    include_in_schema=False,
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_endpoint(
    data: ClientCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        return create_client_controller(db=db, data=data)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "",
    response_model=ClientListResponse,
    summary="List all client companies with active seat statistics",
)
@router.get(
    "/",
    include_in_schema=False,
    response_model=ClientListResponse,
)
def list_clients_endpoint(
    db: Session = Depends(get_db),
):
    return list_clients_controller(db=db)


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Get details of a specific client company",
)
def get_client_endpoint(
    client_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_client_controller(db=db, client_id=client_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


@router.patch(
    "/{client_id}/status",
    response_model=ClientResponse,
    summary="Toggle client access status (Active / Inactive)",
)
def update_client_status_endpoint(
    client_id: int,
    data: ClientUpdateStatusRequest,
    db: Session = Depends(get_db),
):
    try:
        return update_client_status_controller(
            db=db,
            client_id=client_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.patch(
    "/{client_id}/max-users",
    response_model=ClientResponse,
    summary="Update the maximum user seat limit for a client company",
)
def update_client_max_users_endpoint(
    client_id: int,
    data: ClientUpdateMaxUsersRequest,
    db: Session = Depends(get_db),
):
    try:
        return update_client_max_users_controller(
            db=db,
            client_id=client_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
