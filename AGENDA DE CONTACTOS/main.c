#include <stdio.h>
#include <stdlib.h>
#include "menu.h"
#include "contacto.h"
#include "archivo.h"

int main()
{
    Contacto *contactos = NULL;
    int cantidad = 0;
    int ultimoID = 1;
    int opcion;

    cargarContactos(&contactos, &cantidad, &ultimoID);

    do
    {
        mostrarMenu();
        scanf("%d", &opcion);

        while(getchar() != '\n');

        if(opcion < 1 || opcion > 8)
        {
            printf("Opcion invalida.\n");
            opcion = 0;
        }

        switch(opcion)
        {
            case 1:
                agregarContacto(&contactos, &cantidad, &ultimoID);
                break;

            case 2:
                listarContactos(contactos, cantidad);
                break;

            case 3:
                buscarContacto(contactos, cantidad);
                break;

            case 4:
                buscarPorID(contactos, cantidad);
                break;

            case 5:
                editarContacto(contactos, cantidad);
                break;

            case 6:
                eliminarContacto(&contactos, &cantidad);
                break;

            case 7:
                ordenarContactos(contactos, cantidad);
                break;

            case 8:

                guardarContactos(contactos, cantidad);
                printf("Contactos guardados.\nSaliendo...\n");
                break;

            default:
                printf("Opcion invalida.\n");
        }
    } while(opcion != 8);

    free(contactos);

    return 0;
}
