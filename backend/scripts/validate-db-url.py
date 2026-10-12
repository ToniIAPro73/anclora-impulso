#!/usr/bin/env python3
"""Component-wise validation of the isolated test DATABASE_URL (NF-1).

Replaces the shell glob that judged the whole string (a remote authority followed by a local-looking tail matched it).
The URL is split according to RFC 3986 (authority ends at the first '/', '?' or '#'; userinfo ends at the single '@'),
every component is compared with the authorized value, and the query is restricted to a closed list. On success the
CANONICAL URL, rebuilt from the validated components, is printed on stdout: that value (not the original string) is what
test-db.sh hands to Prisma/Jest. On failure only a reason without any part of the URL goes to stderr (exit 1).

Inputs come from the environment, never from argv (argv is visible to other processes):
  DATABASE_URL, TEST_DB_USER, TEST_DB_PORT, TEST_DB_NAME.
Admitted URL form: postgresql://<user>:<percent-encoded password>@127.0.0.1:<port>/<name>[?schema=public]
Not admitted: other schemes (incl. postgres://), hostnames (incl. localhost), IPv6, fragments, any query key other than a
single schema=public (host, hostaddr, port, sslmode, options, ... are rejected without being connected anywhere).
"""
import os
import re
import sys

PCT_PASSWORD = re.compile(r'^(?:[A-Za-z0-9\-._~!$&\'()*+,;=]|%[0-9A-Fa-f]{2})+$')
LOCAL_HOST = '127.0.0.1'


def fail(reason: str):
    sys.stderr.write(reason + '\n')
    sys.exit(1)


def main() -> None:
    url = os.environ.get('DATABASE_URL', '')
    user = os.environ.get('TEST_DB_USER', '')
    port = os.environ.get('TEST_DB_PORT', '')
    name = os.environ.get('TEST_DB_NAME', '')
    if not (url and user and port.isdigit() and name):
        fail('authorized target is incomplete')
    if re.search(r'[\s\\\x00-\x1f\x7f]', url):
        fail('DATABASE_URL contains whitespace, control or backslash characters')

    prefix = 'postgresql://'
    if not url.startswith(prefix):
        fail('DATABASE_URL must use the postgresql:// scheme')
    rest = url[len(prefix):]
    if '#' in rest:
        fail('DATABASE_URL must not contain a fragment')

    cut = len(rest)
    for ch in '/?':
        i = rest.find(ch)
        if i != -1:
            cut = min(cut, i)
    authority, tail = rest[:cut], rest[cut:]

    if authority.count('@') != 1:
        fail('DATABASE_URL authority must contain exactly one @ (encode reserved characters of the password)')
    userinfo, hostport = authority.split('@', 1)
    if ':' not in userinfo:
        fail('DATABASE_URL must carry user and password')
    got_user, password = userinfo.split(':', 1)
    if got_user != user:
        fail('DATABASE_URL user is not the authorized test user')
    if not password or not PCT_PASSWORD.match(password):
        fail('DATABASE_URL password is empty or not percent-encoded')

    if hostport != f'{LOCAL_HOST}:{port}':
        fail('DATABASE_URL host/port is not the authorized loopback endpoint')

    path, _, query = tail.partition('?')
    if path != '/' + name:
        fail('DATABASE_URL database name is not the authorized test database')

    if tail.count('?') > 1:
        fail('DATABASE_URL has more than one query separator')
    if query:
        pairs = query.split('&')
        if pairs != ['schema=public']:
            fail('DATABASE_URL query is restricted to a single schema=public')

    sys.stdout.write(f'postgresql://{got_user}:{password}@{LOCAL_HOST}:{port}/{name}?schema=public')


main()
