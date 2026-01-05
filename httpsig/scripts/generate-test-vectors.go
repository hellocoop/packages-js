package main

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"

	"github.com/yaronf/httpsign"
)

type TestVector struct {
	Name       string            `json:"name"`
	Method     string            `json:"method"`
	URL        string            `json:"url"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body,omitempty"`
	Algorithm  string            `json:"algorithm"` // "Ed25519", "ES256", "RS256"
	PublicKey  map[string]string `json:"publicKey"` // JWK components
	Signature  string            `json:"signature"`
	SigInput   string            `json:"sigInput"`
}

// Helper to convert big.Int to base64url
func bigIntToBase64URL(n *big.Int) string {
	// Ensure 32 bytes for P-256 coordinates
	bytes := n.Bytes()
	if len(bytes) < 32 {
		padded := make([]byte, 32)
		copy(padded[32-len(bytes):], bytes)
		bytes = padded
	}
	return base64.RawURLEncoding.EncodeToString(bytes)
}

func generateEd25519Vector(name, method, url, body string, headers map[string]string) (*TestVector, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	config := httpsign.NewSignConfig()
	fields := httpsign.NewFields()
	signer, err := httpsign.NewEd25519Signer(priv, config, *fields)
	if err != nil {
		return nil, err
	}

	sigInput, signature, err := httpsign.SignRequest("sig", *signer, req)
	if err != nil {
		return nil, err
	}

	return &TestVector{
		Name:      name,
		Method:    method,
		URL:       url,
		Headers:   headers,
		Body:      body,
		Algorithm: "Ed25519",
		PublicKey: map[string]string{
			"kty": "OKP",
			"crv": "Ed25519",
			"x":   base64.RawURLEncoding.EncodeToString(pub),
		},
		Signature: signature,
		SigInput:  sigInput,
	}, nil
}

func generateES256Vector(name, method, url, body string, headers map[string]string) (*TestVector, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}

	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	config := httpsign.NewSignConfig()
	fields := httpsign.NewFields()
	signer, err := httpsign.NewP256Signer(*priv, config, *fields)
	if err != nil {
		return nil, err
	}

	sigInput, signature, err := httpsign.SignRequest("sig", *signer, req)
	if err != nil {
		return nil, err
	}

	return &TestVector{
		Name:      name,
		Method:    method,
		URL:       url,
		Headers:   headers,
		Body:      body,
		Algorithm: "ES256",
		PublicKey: map[string]string{
			"kty": "EC",
			"crv": "P-256",
			"x":   bigIntToBase64URL(priv.PublicKey.X),
			"y":   bigIntToBase64URL(priv.PublicKey.Y),
		},
		Signature: signature,
		SigInput:  sigInput,
	}, nil
}

func generateRS256Vector(name, method, url, body string, headers map[string]string) (*TestVector, error) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}

	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	config := httpsign.NewSignConfig()
	fields := httpsign.NewFields()
	// NewRSAPSSSigner uses RSA-PSS with SHA-512 (matches our implementation)
	signer, err := httpsign.NewRSAPSSSigner(*priv, config, *fields)
	if err != nil {
		return nil, err
	}

	sigInput, signature, err := httpsign.SignRequest("sig", *signer, req)
	if err != nil {
		return nil, err
	}

	return &TestVector{
		Name:      name,
		Method:    method,
		URL:       url,
		Headers:   headers,
		Body:      body,
		Algorithm: "RS256",
		PublicKey: map[string]string{
			"kty": "RSA",
			"n":   base64.RawURLEncoding.EncodeToString(priv.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(priv.PublicKey.E)).Bytes()),
		},
		Signature: signature,
		SigInput:  sigInput,
	}, nil
}

func main() {
	vectors := []*TestVector{}

	// Ed25519 vectors
	tv1, _ := generateEd25519Vector("Ed25519: GET request", "GET", "https://example.com/api/data", "", map[string]string{})
	vectors = append(vectors, tv1)

	tv2, _ := generateEd25519Vector("Ed25519: POST with JSON", "POST", "https://example.com/api/users", `{"name":"Alice"}`, map[string]string{"Content-Type": "application/json"})
	vectors = append(vectors, tv2)

	tv3, _ := generateEd25519Vector("Ed25519: DELETE request", "DELETE", "https://example.com/api/resource/99", "", map[string]string{})
	vectors = append(vectors, tv3)

	// ES256 vectors
	tv4, _ := generateES256Vector("ES256: GET request", "GET", "https://example.com/api/data", "", map[string]string{})
	vectors = append(vectors, tv4)

	tv5, _ := generateES256Vector("ES256: POST with JSON", "POST", "https://example.com/api/users", `{"name":"Bob"}`, map[string]string{"Content-Type": "application/json"})
	vectors = append(vectors, tv5)

	tv6, _ := generateES256Vector("ES256: PUT request", "PUT", "https://example.com/api/resource/42", `{"status":"updated"}`, map[string]string{"Content-Type": "application/json"})
	vectors = append(vectors, tv6)

	// RS256 vectors
	tv7, err7 := generateRS256Vector("RS256: GET request", "GET", "https://example.com/api/data", "", map[string]string{})
	if err7 != nil {
		fmt.Printf("Error generating RS256 vector 1: %v\n", err7)
	}
	vectors = append(vectors, tv7)

	tv8, err8 := generateRS256Vector("RS256: POST with JSON", "POST", "https://example.com/api/users", `{"name":"Charlie"}`, map[string]string{"Content-Type": "application/json"})
	if err8 != nil {
		fmt.Printf("Error generating RS256 vector 2: %v\n", err8)
	}
	vectors = append(vectors, tv8)

	tv9, err9 := generateRS256Vector("RS256: GET with query", "GET", "https://example.com/search?q=test", "", map[string]string{})
	if err9 != nil {
		fmt.Printf("Error generating RS256 vector 3: %v\n", err9)
	}
	vectors = append(vectors, tv9)

	output, _ := json.MarshalIndent(vectors, "", "  ")
	fmt.Println(string(output))
}
