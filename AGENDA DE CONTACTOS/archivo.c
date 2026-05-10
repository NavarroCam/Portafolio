#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "archivo.h"

void guardarContactos(Contacto *contactos, int cantidad)
{
    int i;
    FILE *archivo = fopen(ARCHIVO_CONTACTOS, "w");

    if(archivo == NULL)
    {
        printf("Error al abrir archivo.\n");
        return;
    }

    for(i = 0; i < cantidad; i++)
    {
        fprintf(archivo,"%d;%s;%s;%d\n", (contactos + i)->id, (contactos + i)->nombre, (contactos + i)->telefono, (contactos + i)->edad);
    }

    fclose(archivo);
}

void cargarContactos(Contacto **contactos, int *cantidad, int *ultimoID)
{
    FILE *archivo = fopen(ARCHIVO_CONTACTOS, "r");
    if(archivo == NULL)
    {
        return;
    }

    Contacto temp;
    while(fscanf(archivo, "%d;%49[^;];%19[^;];%d\n", &temp.id, temp.nombre, temp.telefono, &temp.edad) == 4)
    {
        Contacto *nuevo = realloc(*contactos, (*cantidad + 1) * sizeof(Contacto));
        if(nuevo == NULL)
        {
            printf("Error de memoria.\n");
            fclose(archivo);
            return;
        }

        *contactos = nuevo;
        *(*contactos + *cantidad) = temp;
        (*cantidad)++;

        if(temp.id >= *ultimoID)
        {
            *ultimoID = temp.id + 1;
        }
    }

    fclose(archivo);
}
