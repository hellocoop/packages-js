// src/lib/packageMetadata.ts
import basePackageJson from '../../package.json' // Base package's package.json

type PackageMetadata = {
    name: string
    version: string
}

class Metadata {
    private static instance: Metadata
    private metadata?: PackageMetadata
    private baseMetadata: PackageMetadata

    private constructor() {
        // Set the base package's default metadata
        this.baseMetadata = {
            name: basePackageJson.name,
            version: basePackageJson.version,
        }
    }

    // Singleton instance
    public static getInstance(): Metadata {
        if (!Metadata.instance) {
            Metadata.instance = new Metadata()
        }
        return Metadata.instance
    }

    // Allow parent to set metadata (overrides base metadata)
    public setMetadata(name: string, version: string): void {
        this.metadata = { name, version }
    }

    // Get metadata (use parent metadata if set, otherwise fallback to base metadata)
    public getMetadata(): PackageMetadata {
        return this.metadata || this.baseMetadata
    }
}

export const PackageMetadata = Metadata.getInstance()
