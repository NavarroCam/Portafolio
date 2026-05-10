#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "contacto.h"

int validarEdad(int edad)
{
    return edad > 0;
}

int textoVacio(char texto[])
{
    return strlen(texto) == 0;
}

int telefonoValido(char *telefono)
{
    int i;
    for(i = 0; telefono[i] != '\0'; i++)
    {
        if(*telefono < '0' || *telefono > '9')
        {
            return 0;
        }
    }
    return 1;
}

void agregarContacto(Contacto **contactos, int *cantidad, int *ultimoID)
{
    Contacto *temp = realloc(*contactos,(*cantidad + 1)* sizeof(Contacto));
    if(temp == NULL)
    {
        printf("Error de memoria.\n");
        return;
    }

    *contactos = temp;

    Contacto nuevo;
    nuevo.id = (*ultimoID)++;

    getchar();
    printf("Nombre: ");
    fgets(nuevo.nombre, MAX_NOMBRE, stdin);
    nuevo.nombre[strcspn(nuevo.nombre, "\n")] = '\0';

    while(textoVacio(nuevo.nombre))
    {
        printf("Nombre invalido: ");
        fgets(nuevo.nombre, MAX_NOMBRE, stdin);
        nuevo.nombre[strcspn(nuevo.nombre, "\n")] = '\0';
    }

    printf("Telefono: ");
    fgets(nuevo.telefono, MAX_TELEFONO, stdin);
    nuevo.telefono[strcspn(nuevo.telefono, "\n")] = '\0';

    while(textoVacio(nuevo.telefono) || !telefonoValido(nuevo.telefono))
    {
        printf("Telefono invalido(solo numeros): ");
        fgets(nuevo.telefono, MAX_TELEFONO, stdin);
        nuevo.telefono[strcspn(nuevo.telefono, "\n")] = '\0';
    }

    printf("Edad: ");
    scanf("%d", &nuevo.edad);
    while(!validarEdad(nuevo.edad))
    {
        printf("Edad invalida: ");
        scanf("%d", &nuevo.edad);
    }

    (*contactos)[*cantidad] = nuevo;
    (*cantidad)++;

    printf("Contacto agregado.\n");
}

void listarContactos(Contacto *contactos, int cantidad)
{
    int i;

    if(cantidad == 0)
    {
        printf("No hay contactos.\n");
        return;
    }

    for(i = 0; i < cantidad; i++)
    {
        printf("\nID: %d\n", (contactos + i)->id);
        printf("Nombre: %s\n", (contactos + i)->nombre);
        printf("Telefono: %s\n", (contactos + i)->telefono);
        printf("Edad: %d\n", (contactos + i)->edad);
    }
}

void buscarContacto(Contacto *contactos, int cantidad)
{
    int i;
    char nombreBuscado[50];
    int encontrado = 0;

    getchar();

    printf("Ingrese nombre: ");
    fgets(nombreBuscado,50,stdin);

    nombreBuscado[strcspn(nombreBuscado, "\n")] = '\0';

    for(i = 0; i < cantidad; i++)
    {
        if(strstr((contactos+i)->nombre, nombreBuscado) != NULL)
        {
            printf("\nID: %d\n", (contactos + i)->id);
            printf("Nombre: %s\n", (contactos + i)->nombre);
            printf("Telefono: %s\n", (contactos + i)->telefono);
            printf("Edad: %d\n", (contactos + i)->edad);
            encontrado = 1;
        }
    }

    if(!encontrado)
    {
        printf("No encontrado.\n");
    }
}

void buscarPorID(Contacto *contactos, int cantidad)
{
    int id, i=0;
    int encontrado = 0;

    printf("Ingrese ID: ");
    scanf("%d", &id);

    while(i < cantidad && !encontrado)
    {
        if((contactos + i) -> id == id)
        {
            printf("\nNombre: %s\n", (contactos + i)->nombre);
            printf("Telefono: %s\n", (contactos + i)->telefono);
            printf("Edad: %d\n", (contactos + i)->edad);
            encontrado = 1;
        }
        i++;
    }
    if(!encontrado)
    {
        printf("No encontrado.\n");
    }
}

void editarContacto(Contacto *contactos, int cantidad)
{
    int id, i=0;
    int indice = -1;

    printf("ID a editar: ");
    scanf("%d", &id);

    while(i < cantidad && indice == -1)
    {
        if((contactos + i)->id == id)
        {
            indice = i;
        }
        i++;
    }
    if(indice == -1)
    {
        printf("No encontrado.\n");
        return;
    }

    getchar();
    printf("Nuevo nombre: ");
    fgets((contactos + indice)->nombre, MAX_NOMBRE, stdin);
    (contactos + indice)->nombre[strcspn((contactos + indice)->nombre, "\n")] = '\0';

    printf("Nuevo telefono: ");
    fgets((contactos + indice)->telefono, MAX_TELEFONO, stdin);
    (contactos + indice)->telefono[strcspn((contactos + indice)->telefono,"\n")] = '\0';

    printf("Nueva edad: ");
    scanf("%d", &(contactos + indice)->edad);

    printf("Contacto actualizado.\n");
}

void eliminarContacto(Contacto **contactos, int *cantidad)
{
    int id, i=0;
    int indice = -1;

    printf("ID a eliminar: ");
    scanf("%d", &id);

    while(i < *cantidad && indice == -1)
    {
        if(((*contactos) + i)->id == id)
        {
            indice = i;
        }
        i++;
    }

    if(indice == -1)
    {
        printf("No encontrado.\n");
        return;
    }

    for(i = indice; i < *cantidad - 1; i++)
    {
        *((*contactos) + i) = *((*contactos) + i + 1);
    }

    (*cantidad)--;
    *contactos = realloc(*contactos, (*cantidad)* sizeof(Contacto));

    printf("Contacto eliminado.\n");
}

void ordenarContactos(Contacto *contactos, int cantidad)
{
    Contacto aux;
    int i, j;

    for(i = 0; i < cantidad - 1; i++)
    {
        for(j = 0; j < cantidad - i - 1; j++)
        {
            if(strcmp((contactos + j)->nombre, (contactos + j + 1)->nombre) > 0)
            {
                aux = *(contactos + j);
                *(contactos + j) = *(contactos + j + 1);
                *(contactos + j + 1) = aux;
            }
        }
    }
    printf("Contactos ordenados.\n");
}
