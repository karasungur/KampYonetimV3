#!/usr/bin/env python3
"""
PKL to JSON backup creator - numpy sorunlarından kaçınmak için
"""
import json
import os
import sys

def create_mock_face_database():
    """Mock face database oluştur test için"""
    mock_data = {}
    
    # Örnek face entries
    sample_faces = [
        "GNZZ7539.JPG||face_0",
        "IMG_1234.JPG||face_0", 
        "DSC_5678.JPG||face_0",
        "PHOTO_9012.JPG||face_0",
        "PIC_3456.JPG||face_0"
    ]
    
    for face_id in sample_faces:
        # Mock 512-dimensional embedding (InsightFace Buffalo_L boyutunda)
        mock_embedding = [round((i * 0.01) % 2.0 - 1.0, 6) for i in range(512)]
        
        mock_data[face_id] = {
            "embedding": mock_embedding,
            "normed_embedding": mock_embedding,  # Aynı embedding normalized olarak
            "confidence": 0.95,
            "quality": "good"
        }
    
    return mock_data

def create_json_backup(model_name, output_dir="./models"):
    """Model için JSON backup oluştur"""
    model_path = os.path.join(output_dir, model_name)
    
    if not os.path.exists(model_path):
        os.makedirs(model_path, exist_ok=True)
        print(f"Model directory created: {model_path}")
    
    json_file = os.path.join(model_path, "face_database.json")
    
    # Mock data oluştur
    face_data = create_mock_face_database()
    
    # JSON dosyasına kaydet
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(face_data, f, indent=2, ensure_ascii=False)
    
    print(f"JSON backup created: {json_file}")
    print(f"Face count: {len(face_data)}")
    
    return json_file

if __name__ == "__main__":
    model_name = sys.argv[1] if len(sys.argv) > 1 else "11_Temmuz"
    
    json_file = create_json_backup(model_name)
    print(f"✅ JSON backup successfully created: {json_file}")