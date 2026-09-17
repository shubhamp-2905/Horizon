from app.database.session import check_db_connectivity, get_db
from sqlalchemy import text


def test_session_lifecycle(db_session):
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_get_db_generator():
    db_gen = get_db()
    session = next(db_gen)
    assert session is not None
    try:
        pass
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


def test_check_db_connectivity_function():
    # Will execute against engine
    status = check_db_connectivity()
    # Status is boolean (True if DB reachable, False otherwise)
    assert isinstance(status, bool)
