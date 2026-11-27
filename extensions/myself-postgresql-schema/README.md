# Local PostgreSQL Schema

This optional Nerded Code extension shows the schemas, relations, columns, and data types visible to a PostgreSQL role. It runs on macOS and Linux in a trusted local workspace. Open a local SQL file in a workspace folder and choose **Inspect Local PostgreSQL Schema…** from the editor toolbar or context menu.

1. Select an installed `psql` executable and the existing PostgreSQL Unix socket directory. The selected binary and socket directory must have group and other write bits clear.
2. Enter the database and PostgreSQL role as literal ASCII identifiers. Enter the port used in the socket filename.
3. Review the resolved executable, socket, database, and role. Choose **Read Schema** to launch the external client and open the read-only result beside the editor.

The connection must already work through the selected socket with a role that needs no client-side credentials, for example with existing peer authentication. The client library must support `require_auth`. The viewer rejects authentication challenges and uses a fixed metadata query in a read-only transaction. It displays up to 500 columns and reports truncation when applicable.

The viewer takes its inputs from the dialog each time. SQL editor contents, project settings, startup scripts, inherited connection variables, connection profiles, passwords, and account history are outside this workflow. An explicit execution action runs the selected external program with local OS privileges. The file and socket checks cover their identity at the time of inspection. OS path changes and relays managed outside the extension remain outside that check.
