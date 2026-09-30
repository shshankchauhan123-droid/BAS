from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.case.case_controller import (
    create_case,
    get_cases,
    get_case,
    update_case,
    delete_case,
)

from app.core.database import get_db
from app.dependencies.auth import get_current_user

from app.case.case_schema import (
    CaseCreateRequest,
    CaseUpdateRequest,
    CaseResponse,
    CaseListResponse,
)


router = APIRouter(
    prefix="/api/v1/cases",
    tags=["Case Management"],
)


@router.post(
    "/",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_case_route(
    data: CaseCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return create_case(
            db=db,
            data=data,
            user=current_user,
        )

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )



@router.get(
    "/",
    response_model=CaseListResponse,
    status_code=status.HTTP_200_OK,
)
def get_cases_route(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return get_cases(
            db=db,
            user=current_user,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    status_code=status.HTTP_200_OK,
)
def get_case_route(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return get_case(
            db=db,
            case_id=case_id,
            user=current_user,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


@router.put(
    "/{case_id}",
    response_model=CaseResponse,
    status_code=status.HTTP_200_OK,
)
def update_case_route(
    case_id: int,
    data: CaseUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return update_case(
            db=db,
            case_id=case_id,
            data=data,
            user=current_user,
        )

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )


@router.delete(
    "/{case_id}",
    status_code=status.HTTP_200_OK,
)
def delete_case_route(
    case_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return delete_case(
            db=db,
            case_id=case_id,
            user=current_user,
        )

    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )