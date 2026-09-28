from sqlalchemy.orm import Session

from app.files.file_model import File
from app.bank_transactions.bank_transaction_model import BankTransaction

def create_file(
    db: Session,
    file: File,
) -> File:
    db.add(file)
    db.commit()
    db.refresh(file)

    return file


def get_file_by_id(
    db: Session,
    file_id: int,
) -> File | None:
    return (
        db.query(File)
        .filter(File.id == file_id)
        .first()
    )


def get_file_by_id_and_user(
    db: Session,
    file_id: int,
    user_id: int,
) -> File | None:
    return (
        db.query(File)
        .filter(
            File.id == file_id,
            File.created_by == user_id,
        )
        .first()
    )


def get_files_by_case(
    db: Session,
    case_id: int,
) -> list[File]:
    return (
        db.query(File)
        .filter(File.case_id == case_id)
        .order_by(File.created_at.desc())
        .all()
    )


def get_files_by_case_and_user(
    db: Session,
    case_id: int,
    user_id: int,
) -> list[File]:
    return (
        db.query(File)
        .filter(
            File.case_id == case_id,
            File.created_by == user_id,
        )
        .order_by(File.created_at.desc())
        .all()
    )


def update_file(
    db: Session,
    file: File,
) -> File:
    db.commit()
    db.refresh(file)

    return file



def delete_file(
    db: Session,
    file: File,
) -> None:

    # Delete all transactions belonging to this file
    db.query(BankTransaction).filter(
        BankTransaction.file_id == file.id
    ).delete(
        synchronize_session=False
    )

    # Delete the file
    db.delete(file)

    # Save both operations
    db.commit()