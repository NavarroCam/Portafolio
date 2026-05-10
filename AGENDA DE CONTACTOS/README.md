## 📒 AGENDA DE CONTACTOS EN C

==================================================

## 📌 DESCRIPCIÓN

Este proyecto consiste en una Agenda de Contactos desarrollada en lenguaje C, que permite gestionar información de personas mediante un sistema de almacenamiento persistente en archivos.

El programa fue desarrollado utilizando:

- Structs
- Memoria dinámica (malloc, realloc, free)
- Archivos de texto
- Modularización (.c y .h)
- Búsquedas
- Validaciones de datos

==================================================

## 🎯 OBJETIVO DEL PROYECTO

Desarrollar un sistema de gestión de contactos aplicando conceptos fundamentales del lenguaje C como:

- Manejo de memoria dinámica
- Estructuras (struct)
- Archivos
- Punteros
- Modularización
- Validación de datos

==================================================

## ✨ FUNCIONALIDADES IMPLEMENTADAS

## ➕ AGREGAR CONTACTO

Permite ingresar un nuevo contacto con:

- Nombre
- Teléfono
- Edad

Cada contacto recibe un ID único autoincremental.

--------------------------------------------------

## 📋 LISTAR CONTACTOS

Muestra todos los contactos almacenados en memoria.

Información mostrada:

- ID
- Nombre
- Teléfono
- Edad

--------------------------------------------------

## 🔎 BUSCAR CONTACTO POR NOMBRE

Permite buscar contactos mediante coincidencia parcial.

Ejemplo:

Buscar:
mar

Puede encontrar:
Maria
Marcos
Martina

--------------------------------------------------

## 🆔 BUSCAR CONTACTO POR ID

Permite encontrar un contacto específico utilizando su identificador único.

--------------------------------------------------

## ✏️ EDITAR CONTACTO

Permite modificar:

- Nombre
- Teléfono
- Edad

de un contacto existente.

--------------------------------------------------

## ❌ ELIMINAR CONTACTO

Permite borrar un contacto utilizando su ID.

La memoria se reorganiza dinámicamente usando
realloc().

--------------------------------------------------

## 🔤 ORDENAR CONTACTOS

Ordena los contactos alfabéticamente por nombre.

--------------------------------------------------

## 💾 PERSISTENCIA DE DATOS

Los contactos se almacenan automáticamente en:

contactos.txt

Al iniciar el programa:

✓ Los contactos se cargan automáticamente.

Al cerrar el programa:

✓ Los datos se guardan automáticamente.

==================================================

## ✅ VALIDACIONES IMPLEMENTADAS

El sistema incluye validaciones para evitar errores:

- Nombre vacío
- Teléfono vacío
- Teléfono solo numérico
- Edad inválida
- Control de memoria (realloc)
- Manejo de errores de archivo

==================================================

## 🗂️ ESTRUCTURA DEL PROYECTO

AgendaContactos/

│── main.c
│── contacto.c
│── contacto.h
│── menu.c
│── menu.h
│── archivo.c
│── archivo.h
│── contactos.txt
│── README.md


==================================================

## 🧠 CONCEPTOS DE PROGRAMACIÓN UTILIZADOS

Este proyecto implementa:

✓ Structs
✓ Memoria dinámica
✓ Punteros
✓ Modularización
✓ Manejo de archivos
✓ Búsquedas
✓ Ordenamiento
✓ Validación de datos
✓ Manejo de errores

==================================================