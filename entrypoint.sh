#!/bin/sh
set -e
set -x

fix_owner() {
	mkdir -p "$1"
  chown -R $USER_ID $1
}

echo "USER_ID is $USER_ID"

# fix writable folders with the right owner
for i in $(env | grep chown_ | sed 's/^.*=//')
do
  echo Fixing permissions on: $i
  fix_owner "$i"
done


# note that we need to have su-exec available in our container
exec su-exec $USER_ID "$@"
