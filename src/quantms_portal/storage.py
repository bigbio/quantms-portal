"""Storage abstraction for local and S3 paths.

Provides a unified interface for listing directories, reading parquet files,
and writing parquet/JSON files to either local filesystem or S3.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq


def is_s3_path(path: str | Path) -> bool:
    """Check if a path is an S3 URI."""
    return str(path).startswith("s3://")


def list_subdirs(path: str | Path) -> list[str]:
    """List immediate subdirectory names under path (local or S3).

    Excludes entries starting with '.' or '_'.
    """
    path_str = str(path).rstrip("/")

    if is_s3_path(path_str):
        import boto3

        # Parse bucket and prefix from s3://bucket/prefix/
        parts = path_str.replace("s3://", "").split("/", 1)
        bucket = parts[0]
        prefix = parts[1] + "/" if len(parts) > 1 else ""

        s3 = boto3.client("s3")
        result = s3.list_objects_v2(
            Bucket=bucket, Prefix=prefix, Delimiter="/"
        )
        subdirs = []
        for cp in result.get("CommonPrefixes", []):
            name = cp["Prefix"].rstrip("/").split("/")[-1]
            if not name.startswith((".", "_")):
                subdirs.append(name)
        return sorted(subdirs)
    else:
        local = Path(path_str)
        if not local.exists():
            return []
        return sorted(
            d.name
            for d in local.iterdir()
            if d.is_dir() and not d.name.startswith((".", "_"))
        )


def list_files(path: str | Path, suffix: str = ".parquet") -> list[str]:
    """List files with given suffix under path (local or S3). Returns full paths."""
    path_str = str(path).rstrip("/")

    if is_s3_path(path_str):
        import boto3

        parts = path_str.replace("s3://", "").split("/", 1)
        bucket = parts[0]
        prefix = parts[1] + "/" if len(parts) > 1 else ""

        s3 = boto3.client("s3")
        result = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter="/")
        files = []
        for obj in result.get("Contents", []):
            key = obj["Key"]
            if key.endswith(suffix) and key != prefix:
                files.append(f"s3://{bucket}/{key}")
        return sorted(files)
    else:
        local = Path(path_str)
        if not local.exists():
            return []
        return sorted(str(f) for f in local.glob(f"*{suffix}"))


def has_dataset_parquet(path: str | Path) -> bool:
    """Check if a directory contains a *.dataset.parquet file."""
    files = list_files(path, ".dataset.parquet")
    return len(files) > 0


def read_parquet(path: str | Path) -> pa.Table:
    """Read a parquet file from local or S3 path."""
    path_str = str(path)
    if is_s3_path(path_str):
        import s3fs

        fs = s3fs.S3FileSystem()
        return pq.read_table(path_str, filesystem=fs)
    else:
        return pq.read_table(path_str)


def find_parquet(directory: str | Path, pattern: str) -> str | None:
    """Find first parquet file matching pattern in directory.

    Pattern is like '*.dataset.parquet' or '*.sample.parquet'.
    Returns the full path (local or S3) or None.
    """
    suffix = pattern.replace("*", "")
    files = list_files(directory, suffix)
    return files[0] if files else None


def join_path(base: str | Path, *parts: str) -> str:
    """Join path components for local or S3 paths."""
    base_str = str(base).rstrip("/")
    for part in parts:
        base_str = base_str + "/" + part.strip("/")
    return base_str


def write_parquet(table: pa.Table, path: str | Path, compression: str = "zstd") -> None:
    """Write a parquet table to local or S3 path."""
    path_str = str(path)
    if is_s3_path(path_str):
        import s3fs

        fs = s3fs.S3FileSystem()
        pq.write_table(table, path_str, filesystem=fs, compression=compression)
    else:
        local = Path(path_str)
        local.parent.mkdir(parents=True, exist_ok=True)
        pq.write_table(table, str(local), compression=compression)


def write_parquet_dataset(
    table: pa.Table,
    root_path: str | Path,
    partition_cols: list[str],
    compression: str = "zstd",
) -> None:
    """Write a partitioned parquet dataset to local or S3."""
    path_str = str(root_path)
    if is_s3_path(path_str):
        import s3fs

        fs = s3fs.S3FileSystem()
        pq.write_to_dataset(
            table,
            root_path=path_str,
            partition_cols=partition_cols,
            compression=compression,
            filesystem=fs,
        )
    else:
        pq.write_to_dataset(
            table,
            root_path=path_str,
            partition_cols=partition_cols,
            compression=compression,
        )


def get_file_hash(path: str | Path) -> str:
    """Get a hash representing the file's current state (for incremental builds).

    For local files: uses mtime_ns.
    For S3 files: uses ETag.
    """
    import hashlib

    path_str = str(path)
    if is_s3_path(path_str):
        import boto3

        parts = path_str.replace("s3://", "").split("/", 1)
        bucket = parts[0]
        key = parts[1]
        s3 = boto3.client("s3")
        try:
            response = s3.head_object(Bucket=bucket, Key=key)
            return hashlib.md5(response["ETag"].encode()).hexdigest()
        except Exception:
            return ""
    else:
        local = Path(path_str)
        if local.exists():
            return hashlib.md5(f"{local.name}:{local.stat().st_mtime_ns}".encode()).hexdigest()
        return ""
