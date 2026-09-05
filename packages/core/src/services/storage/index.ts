export type { ObjectStorageService, StorageObjectMetadata } from "./base";
export { InMemoryObjectStorageService } from "./in-memory";
export { PrefixRoutedObjectStorageService } from "./prefix-routed";
export {
    S3ObjectStorageService,
    type S3ObjectStorageServiceOptions,
} from "./s3";
