import argparse
import uvicorn

from ncdb_view.app import app
from ncdb.api.database import Database


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--db",
        required=True,
        help="Path to NCDB sqlite database"
    )

    parser.add_argument(
        "--host",
        default="127.0.0.1"
    )

    parser.add_argument(
        "--port",
        type=int,
        default=8734
    )

    args = parser.parse_args()

    # inject database into app state
    app.state.db = Database(args.db)

    uvicorn.run(
        app,
        host=args.host,
        port=args.port
    )


if __name__ == "__main__":
    main()
