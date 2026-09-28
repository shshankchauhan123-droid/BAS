from sqlalchemy.orm import Session

from app.case.case_schema import (
    CaseCreateRequest,
    CaseUpdateRequest,
)

from app.case.case_service import (
    create_case as service_create_case,
    get_cases as service_get_cases,
    get_case as service_get_case,
    update_case as service_update_case,
    delete_case as service_delete_case,
)


def create_case(
    db: Session,
    data: CaseCreateRequest,
    user_id: int,
):
    case = service_create_case(
        db=db,
        data=data,
        user_id=user_id,
    )

    return {
        "success": True,
        "message": "Case created successfully",
        "data": case,
    }


def get_cases(
    db: Session,
    user_id: int,
):
    cases = service_get_cases(
        db=db,
        user_id=user_id,
    )

    return {
        "success": True,
        "message": "Cases fetched successfully",
        "total": len(cases),
        "data": cases,
    }


def get_case(
    db: Session,
    case_id: int,
    user_id: int,
):
    case = service_get_case(
        db=db,
        case_id=case_id,
        user_id=user_id,
    )

    if not case:
        raise ValueError("Case not found")

    return {
        "success": True,
        "message": "Case fetched successfully",
        "data": case,
    }


def update_case(
    db: Session,
    case_id: int,
    data: CaseUpdateRequest,
    user_id: int,
):
    case = service_update_case(
        db=db,
        case_id=case_id,
        data=data,
        user_id=user_id,
    )

    if not case:
        raise ValueError("Case not found")

    return {
        "success": True,
        "message": "Case updated successfully",
        "data": case,
    }


def delete_case(
    db: Session,
    case_id: int,
    user_id: int,
):
    result = service_delete_case(
        db=db,
        case_id=case_id,
        user_id=user_id,
    )

    return {
        "success": True,
        "message": "Case archived successfully",
        "data": result,
    }